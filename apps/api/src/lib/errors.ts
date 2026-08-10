export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detalles?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (msg: string, detalles?: Record<string, string[]>) =>
  new AppError(400, 'BAD_REQUEST', msg, detalles);
export const unauthorized = (msg = 'Necesitas iniciar sesión') =>
  new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'No tienes permiso para esta acción') =>
  new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'No encontrado') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (msg: string) => new AppError(409, 'CONFLICT', msg);
export const unprocessable = (msg: string) => new AppError(422, 'UNPROCESSABLE', msg);
