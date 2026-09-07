"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, type Product, type Sale } from "@/lib/api";
import { formatBRL, formatQty, MILLI, parseBRLToCents } from "@/lib/money";

type CartLine = { product: Product; quantityMilli: number };
type Method = "CASH" | "PIX" | "DEBIT" | "CREDIT";

const METHOD_LABEL: Record<Method, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  DEBIT: "Débito",
  CREDIT: "Crédito",
};

export default function PdvPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<Method>("CASH");
  const [tendered, setTendered] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.products().then(setProducts).catch(() => setMessage("Não foi possível carregar os produtos"));
  }, []);

  // O leitor de código de barras digita e dá Enter. A busca precisa estar
  // sempre pronta para receber, então ela recupera o foco sozinha.
  useEffect(() => {
    searchRef.current?.focus();
  }, [cart.length, lastSale]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F4") {
        e.preventDefault();
        void finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode === q,
    );
  }, [products, query]);

  const subtotalCents = cart.reduce(
    (sum, l) => sum + Math.round((l.product.priceCents * l.quantityMilli) / MILLI),
    0,
  );
  const tenderedCents = parseBRLToCents(tendered);
  const changeCents = method === "CASH" ? tenderedCents - subtotalCents : 0;

  function add(product: Product, quantityMilli = MILLI) {
    setMessage(null);
    setLastSale(null);
    setCart((current) => {
      const index = current.findIndex((l) => l.product.id === product.id);
      if (index === -1) return [...current, { product, quantityMilli }];
      const next = [...current];
      next[index] = { ...next[index], quantityMilli: next[index].quantityMilli + quantityMilli };
      return next;
    });
    setQuery("");
  }

  function changeQty(productId: string, quantityMilli: number) {
    setCart((current) =>
      quantityMilli <= 0
        ? current.filter((l) => l.product.id !== productId)
        : current.map((l) => (l.product.id === productId ? { ...l, quantityMilli } : l)),
    );
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    // Código de barras bate exato; nome vai pela primeira correspondência.
    const exact = products.find((p) => p.barcode === q || p.sku.toLowerCase() === q.toLowerCase());
    const found = exact ?? visible[0];
    if (!found) return setMessage(`Nada encontrado para "${q}"`);
    add(found);
  }

  async function finish() {
    if (cart.length === 0 || busy) return;
    if (method === "CASH" && tenderedCents < subtotalCents) {
      return setMessage("O valor recebido é menor que o total");
    }
    setBusy(true);
    setMessage(null);
    try {
      const sale = await api.createSale({
        items: cart.map((l) => ({ productId: l.product.id, quantityMilli: l.quantityMilli })),
        payment: {
          method,
          ...(method === "CASH" ? { tenderedCents } : {}),
        },
      });
      setLastSale(sale);
      setCart([]);
      setTendered("");
      setProducts(await api.products());
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Erro ao registrar a venda");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 lg:grid-cols-[1fr_26rem]">
      {/* ------------------------------------------------ busca e produtos */}
      <section className="flex min-h-0 flex-col border-r border-line">
        <form onSubmit={submitSearch} className="border-b border-line p-4">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Passe o código de barras ou digite o produto"
            aria-label="Buscar produto"
            className="num w-full rounded border border-line px-4 py-3 text-lg placeholder:text-muted"
          />
          <p className="mt-2 text-sm text-muted">
            Enter adiciona · F2 volta para a busca · F4 finaliza
          </p>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {visible.map((product) => {
              const stock = product.inventory?.quantityMilli ?? 0;
              const out = stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={out}
                  onClick={() => add(product)}
                  className="flex h-28 flex-col justify-between rounded border border-line p-3 text-left hover:border-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="line-clamp-2 text-sm leading-snug">{product.name}</span>
                  <span className="flex items-baseline justify-between">
                    <span className="num font-semibold">{formatBRL(product.priceCents)}</span>
                    <span className={`num text-xs ${out ? "text-stop" : "text-muted"}`}>
                      {out ? "sem estoque" : formatQty(stock, product.byWeight)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {visible.length === 0 && (
            <p className="p-8 text-center text-muted">Nenhum produto com esse nome ou código.</p>
          )}
        </div>
      </section>

      {/* --------------------------------------------- carrinho e pagamento */}
      <aside className="flex min-h-0 flex-col bg-surface">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {cart.length === 0 && !lastSale && (
            <p className="p-6 text-muted">Comece passando um produto pelo leitor.</p>
          )}

          {lastSale && <Receipt sale={lastSale} />}

          <ul className="divide-y divide-line">
            {cart.map((line) => (
              <li key={line.product.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{line.product.name}</p>
                  <p className="num text-xs text-muted">
                    {formatQty(line.quantityMilli, line.product.byWeight)} ×{" "}
                    {formatBRL(line.product.priceCents)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <StepButton
                    label={`Diminuir ${line.product.name}`}
                    onClick={() => changeQty(line.product.id, line.quantityMilli - MILLI)}
                  >
                    −
                  </StepButton>
                  <StepButton
                    label={`Aumentar ${line.product.name}`}
                    onClick={() => changeQty(line.product.id, line.quantityMilli + MILLI)}
                  >
                    +
                  </StepButton>
                </div>
                <span className="num w-20 text-right font-semibold">
                  {formatBRL(Math.round((line.product.priceCents * line.quantityMilli) / MILLI))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-line bg-white p-4">
          <div className="mb-4 flex items-end justify-between">
            <span className="text-sm text-muted">Total</span>
            <span className="num text-4xl font-bold tracking-tight">{formatBRL(subtotalCents)}</span>
          </div>

          <div className="mb-3 grid grid-cols-4 gap-2">
            {(Object.keys(METHOD_LABEL) as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                aria-pressed={method === m}
                className={`rounded border px-2 py-2 text-sm ${
                  method === m ? "border-brand bg-brand-light font-semibold text-brand-dark" : "border-line"
                }`}
              >
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>

          {method === "CASH" && (
            <div className="mb-3 flex items-center gap-3">
              <label htmlFor="tendered" className="text-sm text-muted">
                Recebido
              </label>
              <input
                id="tendered"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="num w-28 rounded border border-line px-3 py-2 text-right"
              />
              <span className="num ml-auto text-sm">
                Troco{" "}
                <strong className={changeCents < 0 ? "text-stop" : "text-ok"}>
                  {formatBRL(Math.max(changeCents, 0))}
                </strong>
              </span>
            </div>
          )}

          {message && (
            <p role="alert" className="mb-3 rounded bg-stop/10 px-3 py-2 text-sm text-stop">
              {message}
            </p>
          )}

          <button
            type="button"
            onClick={finish}
            disabled={cart.length === 0 || busy}
            className="w-full rounded bg-brand px-4 py-4 text-lg font-semibold text-white disabled:opacity-40"
          >
            {busy ? "Registrando…" : "Finalizar venda (F4)"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function StepButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 rounded border border-line bg-white text-lg leading-none"
    >
      {children}
    </button>
  );
}

function Receipt({ sale }: { sale: Sale }) {
  return (
    <div className="border-b border-line bg-white p-4">
      <p className="text-sm text-muted">Cupom {sale.receiptNumber} registrado</p>
      {sale.changeCents != null && sale.changeCents > 0 && (
        <p className="num mt-1 text-2xl font-bold text-ok">
          Troco {formatBRL(sale.changeCents)}
        </p>
      )}
      <ul className="num mt-3 space-y-1 text-sm">
        {sale.items.map((item, i) => (
          <li key={i} className="flex justify-between">
            <span className="truncate pr-2">
              {item.productName} × {item.quantityMilli / MILLI}
            </span>
            <span>{formatBRL(item.totalCents)}</span>
          </li>
        ))}
      </ul>
      <p className="num mt-2 flex justify-between border-t border-line pt-2 font-semibold">
        <span>Total</span>
        <span>{formatBRL(sale.totalCents)}</span>
      </p>
    </div>
  );
}
