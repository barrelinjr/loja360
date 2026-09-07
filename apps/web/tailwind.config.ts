import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#6B7280",
        line: "#E5E7EB",
        surface: "#F9FAFB",
        brand: { DEFAULT: "#0284C7", dark: "#0369A1", light: "#E0F2FE" },
        ok: "#15803D",
        alert: "#B45309",
        stop: "#B91C1C",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
