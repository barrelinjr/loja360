"use client";

import { useEffect, useState } from "react";
import { api, type Product } from "@/lib/api";
import { formatBRL, formatQty } from "@/lib/money";

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.products().then(setProducts).catch(() => setError("Entre com sua conta para ver os produtos"));
  }, []);

  if (error) return <main className="p-8 text-muted">{error}</main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Produtos</h1>
      <table className="mt-4 w-full text-sm">
        <thead className="border-b border-line text-left text-muted">
          <tr>
            <th className="py-2 font-normal">Produto</th>
            <th className="py-2 font-normal">Código</th>
            <th className="py-2 text-right font-normal">Preço</th>
            <th className="py-2 text-right font-normal">Estoque</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {products.map((p) => {
            const stock = p.inventory?.quantityMilli ?? 0;
            const low = stock <= (p.inventory?.reorderMilli ?? 0);
            return (
              <tr key={p.id}>
                <td className="py-2">{p.name}</td>
                <td className="num py-2 text-muted">{p.barcode ?? p.sku}</td>
                <td className="num py-2 text-right">{formatBRL(p.priceCents)}</td>
                <td className={`num py-2 text-right ${low ? "font-semibold text-alert" : ""}`}>
                  {formatQty(stock, p.byWeight)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
