import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa de pelo menos 16 caracteres"),
  API_PORT: z.coerce.number().default(4000),
  /** Domínio do front que pode chamar a API. Em produção, informe o seu. */
  CORS_ORIGIN: z.string().default("*"),
});

// Falha no boot, não na primeira request.
export const env = schema.parse(process.env);
