import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { asyncRoute } from "../../middleware/error";
import { requireAuth, session } from "../../middleware/auth";

export const customersRouter = Router();
customersRouter.use(requireAuth);

const customerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional(),
  document: z.string().optional(),
});

customersRouter.get(
  "/",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const { q } = z.object({ q: z.string().optional() }).parse(req.query);
    res.json(
      await prisma.customer.findMany({
        where: {
          tenantId,
          ...(q
            ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }] }
            : {}),
        },
        orderBy: { name: "asc" },
        take: 50,
      }),
    );
  }),
);

/** O PDV cria cliente pelo telefone no meio da venda — daí o upsert. */
customersRouter.post(
  "/",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const data = customerSchema.parse(req.body);

    if (data.phone) {
      const customer = await prisma.customer.upsert({
        where: { tenantId_phone: { tenantId, phone: data.phone } },
        create: { ...data, tenantId },
        update: { name: data.name, email: data.email, document: data.document },
      });
      return res.status(201).json(customer);
    }
    res.status(201).json(await prisma.customer.create({ data: { ...data, tenantId } }));
  }),
);

customersRouter.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const { tenantId } = session(req);
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, tenantId },
      include: {
        sales: { orderBy: { createdAt: "desc" }, take: 20, include: { items: true } },
      },
    });
    if (!customer) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(customer);
  }),
);
