"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Dashboard } from "@/lib/api";
import { formatBRL } from "@/lib/money";

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch(() => setError("Entre com sua conta para ver o movimento"));
  }, []);

  if (error) {
    return (
      <main className="p-8">
        <p className="text-muted">{error}</p>
        <Link href="/login" className="mt-2 inline-block font-semibold text-brand">
          Entrar
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-xl font-semibold">Movimento de hoje</h1>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Metric label="Vendas" value={data ? String(data.salesCount) : "—"} />
        <Metric label="Faturamento" value={data ? formatBRL(data.revenueCents) : "—"} />
        <Metric label="Ticket médio" value={data ? formatBRL(data.averageTicketCents) : "—"} />
        <Metric
          label="Repor estoque"
          value={data ? String(data.lowStockCount) : "—"}
          tone={data && data.lowStockCount > 0 ? "alert" : undefined}
        />
      </div>

      <section className="mt-8">
        <h2 className="text-sm text-muted">Mais vendidos hoje</h2>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {(data?.topProducts ?? []).map((p) => (
            <li key={p.productId} className="flex justify-between py-2">
              <span>{p.name}</span>
              <span className="num font-semibold">{formatBRL(p.revenueCents)}</span>
            </li>
          ))}
          {data?.topProducts.length === 0 && (
            <li className="py-6 text-muted">Nenhuma venda ainda hoje.</li>
          )}
        </ul>
      </section>

      <Link
        href="/pdv"
        className="mt-8 inline-block rounded bg-brand px-6 py-3 font-semibold text-white"
      >
        Abrir o caixa
      </Link>
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "alert" }) {
  return (
    <div className="rounded border border-line p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`num mt-1 text-2xl font-bold ${tone === "alert" ? "text-alert" : ""}`}>{value}</p>
    </div>
  );
}
