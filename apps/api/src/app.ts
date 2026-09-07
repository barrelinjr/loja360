import cors from "cors";
import express from "express";
import { env } from "./lib/env";
import { authRouter } from "./modules/auth/auth.routes";
import { customersRouter } from "./modules/customers/customers.routes";
import { inventoryRouter } from "./modules/inventory/inventory.routes";
import { productsRouter } from "./modules/products/products.routes";
import { reportsRouter } from "./modules/reports/reports.routes";
import { salesRouter } from "./modules/sales/sales.routes";
import { errorHandler } from "./middleware/error";

export function createApp() {
  const app = express();

  // Em produção, CORS_ORIGIN = domínio do front. Evita que outro site
  // use a sessão do lojista a partir do navegador dele.
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",") }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRouter);
  app.use("/products", productsRouter);
  app.use("/inventory", inventoryRouter);
  app.use("/sales", salesRouter);
  app.use("/customers", customersRouter);
  app.use("/reports", reportsRouter);

  app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada" }));
  app.use(errorHandler);

  return app;
}
