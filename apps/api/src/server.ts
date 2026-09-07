import { config } from "dotenv";
import path from "node:path";

// .env fica na raiz do repositório, não dentro de apps/api.
config({ path: path.resolve(__dirname, "../../../.env") });

import { env } from "./lib/env";
import { createApp } from "./app";

createApp().listen(env.API_PORT, () => {
  console.log(`API do Loja 360 em http://localhost:${env.API_PORT}`);
});
