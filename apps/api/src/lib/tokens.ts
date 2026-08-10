import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Rol } from '@gina/shared';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { unauthorized } from './errors.js';

export interface AccessPayload {
  sub: string;
  rol: Rol;
}

export function firmarAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.ACCESS_TOKEN_TTL,
    issuer: 'gina-boutique',
  } as jwt.SignOptions);
}

export function verificarAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: 'gina-boutique' });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('payload inválido');
    return { sub: String(decoded.sub), rol: (decoded as jwt.JwtPayload).rol as Rol };
  } catch {
    throw unauthorized('Tu sesión expiró, inicia sesión de nuevo');
  }
}

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * El refresh token se firma con su propio secreto y además se guarda hasheado en
 * la base, para poder revocar sesiones sin esperar a que expire el JWT.
 */
export async function emitirRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DIAS}d`,
    issuer: 'gina-boutique',
  } as jwt.SignOptions);

  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DIAS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return token;
}

/** Valida el refresh token y lo rota: el token viejo queda revocado. */
export async function rotarRefreshToken(
  token: string,
): Promise<{ userId: string; refreshToken: string }> {
  let userId: string;
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'gina-boutique' });
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('payload inválido');
    userId = String(decoded.sub);
  } catch {
    throw unauthorized('Refresh token inválido');
  }

  const guardado = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!guardado || guardado.revokedAt || guardado.expiresAt < new Date()) {
    throw unauthorized('Refresh token inválido o revocado');
  }

  await prisma.refreshToken.update({
    where: { id: guardado.id },
    data: { revokedAt: new Date() },
  });

  return { userId, refreshToken: await emitirRefreshToken(userId) };
}

export async function revocarRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revocarTodasLasSesiones(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
