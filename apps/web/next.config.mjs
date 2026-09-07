import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Empacota só os arquivos usados, para a imagem Docker ficar pequena.
  output: "standalone",
  // Sem isso o Next rastreia a partir de apps/web e perde o node_modules da raiz.
  outputFileTracingRoot: path.join(here, "../../"),
};
