import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { badRequest } from '../lib/errors.js';

function detallesDeZod(error: import('zod').ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join('.') || '_';
    (out[campo] ??= []).push(issue.message);
  }
  return out;
}

/** Valida y reemplaza req.body con el resultado parseado (con defaults aplicados). */
export function validarBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(badRequest('Revisa los datos enviados', detallesDeZod(result.error)));
    }
    req.body = result.data;
    next();
  };
}

/**
 * Valida el query string. Express tipa req.query como ParsedQs, así que el
 * resultado se guarda en res.locals.query y los handlers lo leen de ahí.
 */
export function validarQuery<T>(schema: ZodSchema<T>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(badRequest('Filtros inválidos', detallesDeZod(result.error)));
    }
    res.locals.query = result.data;
    next();
  };
}

export const queryValidado = <T>(res: Response): T => res.locals.query as T;

/** Envuelve handlers async para que los rechazos lleguen al manejador de errores. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
