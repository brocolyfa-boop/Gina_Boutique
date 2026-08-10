import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { message: 'Ruta no encontrada', code: 'NOT_FOUND' } });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { message: err.message, code: err.code, ...(err.detalles && { detalles: err.detalles }) },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: { message: 'Ese registro ya existe', code: 'CONFLICT' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: { message: 'No encontrado', code: 'NOT_FOUND' } });
      return;
    }
  }

  console.error('[error no manejado]', err);
  res.status(500).json({
    error: {
      message: env.isProd ? 'Error interno del servidor' : String(err),
      code: 'INTERNAL_ERROR',
    },
  });
}
