/**
 * Dinheiro em centavos, quantidade em milésimos de unidade.
 * Nada de float em cálculo de venda.
 */

/** 3 unidades -> 3000. 1,250 kg -> 1250. */
export const MILLI = 1000;

/** Preço unitário (centavos) x quantidade (milli) -> centavos, arredondado. */
export function lineTotalCents(unitCents: number, quantityMilli: number): number {
  return Math.round((unitCents * quantityMilli) / MILLI);
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatQuantity(milli: number, byWeight: boolean): string {
  return byWeight ? (milli / MILLI).toFixed(3).replace(".", ",") : String(milli / MILLI);
}
