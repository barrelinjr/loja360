export const MILLI = 1000;

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQty(milli: number, byWeight: boolean): string {
  return byWeight ? (milli / MILLI).toFixed(3).replace(".", ",") : String(milli / MILLI);
}

/** "12,50" | "12.50" | "1250" (com hint de centavos) -> centavos */
export function parseBRLToCents(input: string): number {
  const normalized = input.replace(/[^\d,.-]/g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
