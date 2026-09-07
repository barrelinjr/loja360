declare global {
  interface Window {
    __LOJA360_API__?: string;
  }
}

/** Injetada pelo layout a cada request — ver apps/web/app/layout.tsx. */
function apiBase(): string {
  if (typeof window !== "undefined" && window.__LOJA360_API__) return window.__LOJA360_API__;
  return process.env.API_URL ?? "http://localhost:4000";
}

const TOKEN_KEY = "loja360.token";

export type Product = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  priceCents: number;
  byWeight: boolean;
  category: { id: string; name: string } | null;
  inventory: { quantityMilli: number; reorderMilli: number } | null;
};

export type SaleItem = {
  productName: string;
  quantityMilli: number;
  unitCents: number;
  totalCents: number;
};

export type Sale = {
  id: string;
  receiptNumber: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  createdAt: string;
  changeCents: number | null;
  items: SaleItem[];
};

export type Dashboard = {
  date: string;
  salesCount: number;
  revenueCents: number;
  averageTicketCents: number;
  byMethod: { method: string; amountCents: number }[];
  topProducts: { productId: string; name: string; quantityMilli: number; revenueCents: number }[];
  lowStockCount: number;
};

export const token = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (value: string) => window.localStorage.setItem(TOKEN_KEY, value),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const auth = token.get();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    token.clear();
    window.location.href = "/login";
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "Não foi possível completar a ação");
  }
  return body as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { name: string; role: string }; tenant: { name: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    ),

  products: (q?: string) =>
    request<Product[]>(`/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  createSale: (payload: {
    items: { productId: string; quantityMilli: number }[];
    customerId?: string;
    discountCents?: number;
    payment: { method: string; tenderedCents?: number };
  }) => request<Sale>("/sales", { method: "POST", body: JSON.stringify(payload) }),

  sales: () => request<(Sale & { customer: { name: string } | null })[]>("/sales"),

  dashboard: () => request<Dashboard>("/reports/dashboard"),

  lowStock: () =>
    request<{ id: string; name: string; quantityMilli: number; reorderMilli: number }[]>(
      "/inventory/low-stock",
    ),
};
