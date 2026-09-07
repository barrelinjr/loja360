import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import { HttpError } from "../lib/http-error";

export type Session = {
  userId: string;
  tenantId: string;
  role: "ADMIN" | "MANAGER" | "CASHIER";
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export function signToken(session: Session): string {
  return jwt.sign(session, env.JWT_SECRET, { expiresIn: "12h" });
}

/**
 * Toda rota de negócio passa por aqui. O tenantId vem do token, nunca do
 * body ou da query — é o que impede um tenant de ler dados do outro.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Faça login para continuar"));
  }
  try {
    req.session = jwt.verify(header.slice(7), env.JWT_SECRET) as Session;
    next();
  } catch {
    next(new HttpError(401, "Sessão expirada. Faça login de novo"));
  }
}

export function requireRole(...roles: Session["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session || !roles.includes(req.session.role)) {
      return next(new HttpError(403, "Seu usuário não tem acesso a essa ação"));
    }
    next();
  };
}

/** Atalho: sessão garantida depois do requireAuth. */
export function session(req: Request): Session {
  if (!req.session) throw new HttpError(401, "Faça login para continuar");
  return req.session;
}
