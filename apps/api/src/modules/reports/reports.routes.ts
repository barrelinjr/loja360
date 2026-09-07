import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../middleware/error";
import { requireAuth, session } from "../../middleware/auth";

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

/** O painel que o lojista abre de manhã e no fim do dia. */
reportsRouter.get(
  "/dashboard",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const [totals, byMethod, topProducts, lowStock] = await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, status: "COMPLETED", createdAt: { gte: since } },
        _sum: { totalCents: true, discountCents: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { tenantId, status: "PAID", createdAt: { gte: since } },
        _sum: { amountCents: true },
      }),
      prisma.saleItem.groupBy({
        by: ["productId", "productName"],
        where: { sale: { tenantId, status: "COMPLETED", createdAt: { gte: since } } },
        _sum: { quantityMilli: true, totalCents: true },
        orderBy: { _sum: { totalCents: "desc" } },
        take: 5,
      }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count
        FROM "Inventory" i
        JOIN "Product" p ON p.id = i."productId"
        WHERE i."tenantId" = ${tenantId} AND p.active = true
          AND i."quantityMilli" <= i."reorderMilli"
      `,
    ]);

    const salesCount = totals._count;
    const revenueCents = totals._sum.totalCents ?? 0;

    res.json({
      date: since.toISOString().slice(0, 10),
      salesCount,
      revenueCents,
      discountCents: totals._sum.discountCents ?? 0,
      averageTicketCents: salesCount > 0 ? Math.round(revenueCents / salesCount) : 0,
      byMethod: byMethod.map((m) => ({ method: m.method, amountCents: m._sum.amountCents ?? 0 })),
      topProducts: topProducts.map((p) => ({
        productId: p.productId,
        name: p.productName,
        quantityMilli: p._sum.quantityMilli ?? 0,
        revenueCents: p._sum.totalCents ?? 0,
      })),
      lowStockCount: Number(lowStock[0]?.count ?? 0),
    });
  }),
);
