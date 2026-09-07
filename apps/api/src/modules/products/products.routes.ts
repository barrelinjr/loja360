import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../middleware/error";
import { requireAuth, requireRole, session } from "../../middleware/auth";

export const productsRouter = Router();
productsRouter.use(requireAuth);

const productSchema = z.object({
  sku: z.string().min(1),
  barcode: z.string().min(1).optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  priceCents: z.number().int().positive(),
  costCents: z.number().int().min(0).default(0),
  byWeight: z.boolean().default(false),
  /** Estoque inicial, em milésimos. */
  quantityMilli: z.number().int().min(0).default(0),
  reorderMilli: z.number().int().min(0).default(0),
});

/** Busca do PDV: código de barras exato primeiro, depois nome/SKU. */
productsRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const { q, categoryId } = z
      .object({ q: z.string().optional(), categoryId: z.string().optional() })
      .parse(req.query);

    if (q) {
      const exact = await prisma.product.findFirst({
        where: { tenantId, active: true, OR: [{ barcode: q }, { sku: q }] },
        include: { inventory: true, category: true },
      });
      if (exact) return res.json([exact]);
    }

    const products = await prisma.product.findMany({
      where: {
        tenantId,
        active: true,
        ...(categoryId ? { categoryId } : {}),
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      include: { inventory: true, category: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    res.json(products);
  }),
);

productsRouter.post(
  "/",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const { quantityMilli, reorderMilli, ...data } = productSchema.parse(req.body);

    const product = await prisma.product.create({
      data: {
        ...data,
        tenantId,
        inventory: { create: { tenantId, quantityMilli, reorderMilli } },
      },
      include: { inventory: true },
    });
    res.status(201).json(product);
  }),
);

productsRouter.patch(
  "/:id",
  requireRole("ADMIN", "MANAGER"),
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const data = productSchema.partial().omit({ quantityMilli: true, reorderMilli: true }).parse(req.body);

    const updated = await prisma.product.updateMany({ where: { id: req.params.id, tenantId }, data });
    if (updated.count === 0) return res.status(404).json({ error: "Produto não encontrado" });

    res.json(await prisma.product.findUnique({ where: { id: req.params.id }, include: { inventory: true } }));
  }),
);

productsRouter.get(
  "/categories",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    res.json(
      await prisma.category.findMany({ where: { tenantId }, orderBy: [{ position: "asc" }, { name: "asc" }] }),
    );
  }),
);
