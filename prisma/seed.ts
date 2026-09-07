import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Loja de demonstração: uma padaria pequena, do tamanho dos clientes-piloto.
 * `npm run db:seed`
 */
async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { cnpj: "12345678000199" },
    update: {},
    create: {
      name: "Padaria Modelo",
      cnpj: "12345678000199",
      segment: "padaria",
      plan: "STARTER",
    },
  });

  await prisma.user.upsert({
    where: { email: "dono@padariamodelo.com.br" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Ana (dona)",
      email: "dono@padariamodelo.com.br",
      passwordHash: await bcrypt.hash("loja360", 10),
      role: "ADMIN",
    },
  });

  await prisma.user.upsert({
    where: { email: "caixa@padariamodelo.com.br" },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Carlos (caixa)",
      email: "caixa@padariamodelo.com.br",
      passwordHash: await bcrypt.hash("loja360", 10),
      role: "CASHIER",
    },
  });

  const categorias = [
    { name: "Padaria", position: 1 },
    { name: "Confeitaria", position: 2 },
    { name: "Bebidas", position: 3 },
    { name: "Mercearia", position: 4 },
  ];

  const categoryId: Record<string, string> = {};
  for (const c of categorias) {
    const cat = await prisma.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: c.name } },
      update: { position: c.position },
      create: { ...c, tenantId: tenant.id },
    });
    categoryId[c.name] = cat.id;
  }

  const produtos = [
    { sku: "PAO001", barcode: "7891000000011", name: "Pão francês (kg)", cat: "Padaria", price: 1890, cost: 900, byWeight: true, qty: 25_000, reorder: 5_000 },
    { sku: "PAO002", barcode: "7891000000028", name: "Pão de queijo (un)", cat: "Padaria", price: 250, cost: 110, byWeight: false, qty: 120_000, reorder: 20_000 },
    { sku: "CON001", barcode: "7891000000035", name: "Bolo de fubá (fatia)", cat: "Confeitaria", price: 800, cost: 300, byWeight: false, qty: 18_000, reorder: 6_000 },
    { sku: "CON002", barcode: "7891000000042", name: "Sonho recheado", cat: "Confeitaria", price: 650, cost: 250, byWeight: false, qty: 10_000, reorder: 4_000 },
    { sku: "BEB001", barcode: "7891000000059", name: "Café coado 200ml", cat: "Bebidas", price: 400, cost: 90, byWeight: false, qty: 200_000, reorder: 30_000 },
    { sku: "BEB002", barcode: "7891000000066", name: "Suco de laranja 300ml", cat: "Bebidas", price: 900, cost: 400, byWeight: false, qty: 24_000, reorder: 8_000 },
    { sku: "MER001", barcode: "7891000000073", name: "Leite integral 1L", cat: "Mercearia", price: 549, cost: 420, byWeight: false, qty: 40_000, reorder: 12_000 },
    { sku: "MER002", barcode: "7891000000080", name: "Manteiga 200g", cat: "Mercearia", price: 1290, cost: 950, byWeight: false, qty: 9_000, reorder: 10_000 },
  ];

  for (const p of produtos) {
    await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: p.sku } },
      update: { priceCents: p.price, costCents: p.cost },
      create: {
        tenantId: tenant.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        categoryId: categoryId[p.cat],
        priceCents: p.price,
        costCents: p.cost,
        byWeight: p.byWeight,
        inventory: { create: { tenantId: tenant.id, quantityMilli: p.qty, reorderMilli: p.reorder } },
      },
    });
  }

  await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId: tenant.id, phone: "16999990000" } },
    update: {},
    create: { tenantId: tenant.id, name: "Dona Marta", phone: "16999990000" },
  });

  console.log("Seed pronto.");
  console.log("  Login dono:  dono@padariamodelo.com.br / loja360");
  console.log("  Login caixa: caixa@padariamodelo.com.br / loja360");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
