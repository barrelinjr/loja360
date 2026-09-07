import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../lib/http-error";
import { asyncRoute } from "../../middleware/error";
import { requireAuth, requireRole, session } from "../../middleware/auth";

export const inventoryRouter = Router();
inventoryRouter.use(requireAuth);

/** Produtos no nível de reposição ou abaixo. Alimenta o alerta do painel. */
inventoryRouter.get(
  "/low-stock",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    // Comparação entre duas colunas: Prisma ainda não expressa isso no where,
    // então vai SQL cru mesmo.
    const rows = await prisma.$queryRaw<
      { id: string; name: string; quantityMilli: number; reorderMilli: number }[]
    >`
      SELECT p.id, p.name, i."quantityMilli", i."reorderMilli"
      FROM "Inventory" i
      JOIN "Product" p ON p.id = i."productId"
      WHERE i."tenantId" = ${tenantId}
        AND p.active = true
        AND i."quantityMilli" <= i."reorderMilli"
      ORDER BY (i."quantityMilli" - i."reorderMilli") ASC
      LIMIT 50
    `;
    res.json(rows);
  }),
);

const adjustSchema = z.object({
  /** Positivo entra, negativo sai. */
  quantityMilli: z.number().int().refine((n) => n !== 0, "Informe uma quantidade"),
  type: z.enum(["PURCHASE", "ADJUSTMENT", "LOSS"]),
  reason: z.string().min(3),
});

inventoryRouter.post(
  "/:productId/adjust",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const { tenantId, userId } = session(req);
    const { quantityMilli, type, reason } = adjustSchema.parse(req.body);
    const { productId } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, tenantId } });
      if (!product) return null;

      const inventory = await tx.inventory.update({
        where: { productId },
        data: { quantityMilli: { increment: quantityMilli } },
      });
      if (inventory.quantityMilli < 0) {
        throw new HttpError(422, "Esse ajuste deixaria o estoque negativo");
      }

      await tx.inventoryMovement.create({
        data: {
          tenantId,
          productId,
          type,
          quantityMilli,
          balanceMilli: inventory.quantityMilli,
          reason,
          createdBy: userId,
        },
      });
      return inventory;
    });

    if (!result) return res.status(404).json({ error: "Produto não encontrado" });
    res.json(result);
  }),
);

inventoryRouter.get(
  "/:productId/movements",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    res.json(
      await prisma.inventoryMovement.findMany({
        where: { tenantId, productId: req.params.productId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );
  }),
);
