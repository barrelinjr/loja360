import { Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import { lineTotalCents } from "../../lib/money";
import type { Session } from "../../middleware/auth";

export type SaleItemInput = { productId: string; quantityMilli: number };

export type CreateSaleInput = {
  items: SaleItemInput[];
  customerId?: string;
  discountCents?: number;
  payment: {
    method: PaymentMethod;
    /** Só para dinheiro: quanto o cliente entregou. */
    tenderedCents?: number;
  };
};

/**
 * Cria a venda inteira em uma transação.
 *
 * Duas regras que valem a leitura:
 *
 * 1. O preço vem do banco, nunca do cliente. O front manda produto +
 *    quantidade; quem soma é o servidor. Senão qualquer um vende a R$ 0,01.
 *
 * 2. A baixa de estoque é um UPDATE condicional (`quantityMilli >= n`).
 *    Se dois caixas venderem a última unidade no mesmo instante, o segundo
 *    update afeta 0 linhas e a venda é recusada — em vez de deixar o
 *    estoque negativo, que é o bug clássico de PDV com duas máquinas.
 */
export async function createSale(session: Session, input: CreateSaleInput) {
  if (input.items.length === 0) {
    throw new HttpError(422, "A venda precisa de pelo menos um item");
  }

  const { tenantId, userId } = session;

  return prisma.$transaction(
    async (tx) => {
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { tenantId, id: { in: productIds }, active: true },
      });

      const byId = new Map(products.map((p) => [p.id, p]));
      const missing = productIds.filter((id) => !byId.has(id));
      if (missing.length > 0) {
        throw new HttpError(422, "Produto do carrinho não está mais disponível", { missing });
      }

      // --- itens e totais (preço do banco) ---
      const items = input.items.map((item) => {
        const product = byId.get(item.productId)!;
        if (item.quantityMilli <= 0) {
          throw new HttpError(422, `Quantidade inválida em ${product.name}`);
        }
        if (!product.byWeight && item.quantityMilli % 1000 !== 0) {
          throw new HttpError(422, `${product.name} não é vendido fracionado`);
        }
        return {
          productId: product.id,
          productName: product.name,
          quantityMilli: item.quantityMilli,
          unitCents: product.priceCents,
          totalCents: lineTotalCents(product.priceCents, item.quantityMilli),
        };
      });

      const subtotalCents = items.reduce((sum, i) => sum + i.totalCents, 0);
      const discountCents = input.discountCents ?? 0;
      if (discountCents < 0 || discountCents > subtotalCents) {
        throw new HttpError(422, "Desconto maior que o valor da venda");
      }
      const totalCents = subtotalCents - discountCents;

      // --- pagamento ---
      const { method, tenderedCents } = input.payment;
      let changeCents: number | null = null;
      if (method === "CASH") {
        if (tenderedCents == null || tenderedCents < totalCents) {
          throw new HttpError(422, "Valor recebido menor que o total da venda");
        }
        changeCents = tenderedCents - totalCents;
      }

      // --- baixa de estoque, item a item, condicional ---
      for (const item of items) {
        const updated = await tx.inventory.updateMany({
          where: {
            tenantId,
            productId: item.productId,
            quantityMilli: { gte: item.quantityMilli },
          },
          data: { quantityMilli: { decrement: item.quantityMilli } },
        });
        if (updated.count === 0) {
          throw new HttpError(409, `Estoque insuficiente: ${item.productName}`);
        }
      }

      // --- número do cupom, sequencial por loja ---
      const counter = await tx.counter.upsert({
        where: { tenantId_name: { tenantId, name: "receipt" } },
        create: { tenantId, name: "receipt", value: 1 },
        update: { value: { increment: 1 } },
      });

      const sale = await tx.sale.create({
        data: {
          tenantId,
          receiptNumber: counter.value,
          cashierId: userId,
          customerId: input.customerId,
          subtotalCents,
          discountCents,
          totalCents,
          items: { createMany: { data: items } },
          payments: {
            create: {
              tenantId,
              method,
              amountCents: totalCents,
              tenderedCents: method === "CASH" ? tenderedCents : null,
              changeCents,
              // Pix e cartão viram PENDING quando o gateway entrar (fase 2).
              status: "PAID",
            },
          },
        },
        include: { items: true, payments: true, customer: true, cashier: { select: { name: true } } },
      });

      // --- movimentos de estoque (histórico auditável) ---
      const balances = await tx.inventory.findMany({
        where: { tenantId, productId: { in: productIds } },
        select: { productId: true, quantityMilli: true },
      });
      const balanceOf = new Map(balances.map((b) => [b.productId, b.quantityMilli]));

      await tx.inventoryMovement.createMany({
        data: items.map((item) => ({
          tenantId,
          productId: item.productId,
          type: "SALE" as const,
          quantityMilli: -item.quantityMilli,
          balanceMilli: balanceOf.get(item.productId) ?? 0,
          saleId: sale.id,
          createdBy: userId,
        })),
      });

      // --- CRM: só se a venda foi identificada ---
      if (input.customerId) {
        // updateMany com tenantId no where: cliente de outra loja não é tocado.
        const touched = await tx.customer.updateMany({
          where: { id: input.customerId, tenantId },
          data: {
            lastPurchaseAt: sale.createdAt,
            totalSpentCents: { increment: totalCents },
            purchaseCount: { increment: 1 },
            // 1 ponto por real gasto.
            loyaltyPoints: { increment: Math.floor(totalCents / 100) },
          },
        });
        if (touched.count === 0) throw new HttpError(422, "Cliente não encontrado");

        await tx.customer.updateMany({
          where: { id: input.customerId, tenantId, firstPurchaseAt: null },
          data: { firstPurchaseAt: sale.createdAt },
        });
      }

      return { ...sale, changeCents };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000 },
  );
}

/** Cancela a venda e devolve tudo ao estoque. */
export async function cancelSale(session: Session, saleId: string, reason: string) {
  const { tenantId, userId } = session;

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
      where: { id: saleId, tenantId },
      include: { items: true },
    });
    if (!sale) throw new HttpError(404, "Venda não encontrada");
    if (sale.status !== "COMPLETED") throw new HttpError(409, "Essa venda já foi cancelada");

    for (const item of sale.items) {
      const inventory = await tx.inventory.update({
        where: { productId: item.productId },
        data: { quantityMilli: { increment: item.quantityMilli } },
      });
      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId: item.productId,
          type: "RETURN",
          quantityMilli: item.quantityMilli,
          balanceMilli: inventory.quantityMilli,
          reason,
          saleId: sale.id,
          createdBy: userId,
        },
      });
    }

    if (sale.customerId) {
      await tx.customer.update({
        where: { id: sale.customerId },
        data: {
          totalSpentCents: { decrement: sale.totalCents },
          purchaseCount: { decrement: 1 },
          loyaltyPoints: { decrement: Math.floor(sale.totalCents / 100) },
        },
      });
    }

    await tx.payment.updateMany({ where: { saleId: sale.id }, data: { status: "REFUNDED" } });

    return tx.sale.update({
      where: { id: sale.id },
      data: { status: "CANCELLED" },
      include: { items: true },
    });
  });
}
