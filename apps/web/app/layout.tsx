import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// A tela do caixa não deve ser servida de cache estático, e é aqui que
// injetamos a URL da API a cada request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Loja 360",
  description: "Caixa, estoque e clientes no mesmo lugar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        {/* A mesma imagem Docker roda em qualquer loja: a URL da API vem da
            variável de ambiente na hora do request, não do build. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__LOJA360_API__=${JSON.stringify(
              process.env.API_URL ?? "http://localhost:4000",
            )}`,
          }}
        />
        <header className="flex h-14 items-center gap-6 border-b border-line px-4">
          <Link href="/" className="font-bold tracking-tight">
            Loja 360
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/pdv" className="hover:text-brand">
              Caixa
            </Link>
            <Link href="/produtos" className="hover:text-brand">
              Produtos
            </Link>
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
