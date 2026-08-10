import type { NextFunction, Request, Response } from 'express';
import type { Rol } from '@gina/shared';
import { forbidden, unauthorized } from '../lib/errors.js';
import { verificarAccessToken } from '../lib/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: { id: string; rol: Rol };
    }
  }
}

function leerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/** Exige sesión válida. */
export function requiereAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = leerToken(req);
  if (!token) return next(unauthorized());
  try {
    const { sub, rol } = verificarAccessToken(token);
    req.usuario = { id: sub, rol };
    next();
  } catch (err) {
    next(err);
  }
}

/** Adjunta el usuario si hay token, pero deja pasar invitados (carrito, catálogo). */
export function authOpcional(req: Request, _res: Response, next: NextFunction): void {
  const token = leerToken(req);
  if (!token) return next();
  try {
    const { sub, rol } = verificarAccessToken(token);
    req.usuario = { id: sub, rol };
  } catch {
    // Token vencido en una ruta pública: se sigue como invitado.
  }
  next();
}

export function requiereAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.usuario) return next(unauthorized());
  if (req.usuario.rol !== 'admin') return next(forbidden('Solo administradores'));
  next();
}
