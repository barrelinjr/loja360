import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../middleware/error";
import { requireAuth, requireRole, session } from "../../middleware/auth";
import { cancelSale, createSale } from "./sale.service";

export const salesRouter = Router();
salesRouter.use(requireAuth);

const createSaleSchema = z.object({
  items: z
    .array(z.object({ productId: z.string().min(1), quantityMilli: z.number().int().positive() }))
    .min(1),
  customerId: z.string().optional(),
  discountCents: z.number().int().min(0).optional(),
  payment: z.object({
    method: z.enum(["CASH", "PIX", "DEBIT", "CREDIT"]),
    tenderedCents: z.number().int().min(0).optional(),
  }),
});

salesRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const sale = await createSale(session(req), createSaleSchema.parse(req.body));
    res.status(201).json(sale);
  }),
);

salesRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const { from, to } = z
      .object({ from: z.string().optional(), to: z.string().optional() })
      .parse(req.query);

    const sales = await prisma.sale.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: from ? new Date(from) : startOfToday(),
          ...(to ? { lte: new Date(to) } : {}),
        },
      },
      include: { items: true, payments: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(sales);
  }),
);

salesRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, tenantId },
      include: { items: true, payments: true, customer: true, cashier: { select: { name: true } } },
    });
    if (!sale) return res.status(404).json({ error: "Venda não encontrada" });
    res.json(sale);
  }),
);

salesRouter.post(
  "/:id/cancel",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const { reason } = z.object({ reason: z.string().min(3) }).parse(req.body);
    res.json(await cancelSale(session(req), req.params.id, reason));
  }),
);

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
