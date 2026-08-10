import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  actualizarPerfilSchema,
  loginSchema,
  refreshSchema,
  registroSchema,
  type AuthResponse,
} from '@gina/shared';
import { prisma } from '../prisma.js';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { toUserDTO } from '../lib/dto.js';
import {
  emitirRefreshToken,
  firmarAccessToken,
  revocarRefreshToken,
  rotarRefreshToken,
} from '../lib/tokens.js';
import { requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

/** Freno a la fuerza bruta sobre login/registro. */
const limiteAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, prueba en unos minutos', code: 'RATE_LIMIT' } },
});

router.post(
  '/registro',
  limiteAuth,
  validarBody(registroSchema),
  asyncHandler(async (req, res) => {
    const { nombre, email, password, telefono } = req.body;

    const existente = await prisma.user.findUnique({ where: { email } });
    if (existente) throw conflict('Ya existe una cuenta con ese correo');

    const user = await prisma.user.create({
      data: {
        nombre,
        email,
        telefono: telefono ?? null,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });

    const respuesta: AuthResponse = {
      user: toUserDTO(user),
      accessToken: firmarAccessToken({ sub: user.id, rol: user.rol }),
      refreshToken: await emitirRefreshToken(user.id),
    };
    res.status(201).json(respuesta);
  }),
);

router.post(
  '/login',
  limiteAuth,
  validarBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    // Mismo mensaje para email inexistente y password mala: no revelamos qué falló.
    const passwordOk = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !passwordOk) throw unauthorized('Correo o contraseña incorrectos');

    const respuesta: AuthResponse = {
      user: toUserDTO(user),
      accessToken: firmarAccessToken({ sub: user.id, rol: user.rol }),
      refreshToken: await emitirRefreshToken(user.id),
    };
    res.json(respuesta);
  }),
);

router.post(
  '/refresh',
  validarBody(refreshSchema),
  asyncHandler(async (req, res) => {
    const { userId, refreshToken } = await rotarRefreshToken(req.body.refreshToken);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized('Cuenta no disponible');

    const respuesta: AuthResponse = {
      user: toUserDTO(user),
      accessToken: firmarAccessToken({ sub: user.id, rol: user.rol }),
      refreshToken,
    };
    res.json(respuesta);
  }),
);

router.post(
  '/logout',
  validarBody(refreshSchema),
  asyncHandler(async (req, res) => {
    await revocarRefreshToken(req.body.refreshToken);
    res.status(204).end();
  }),
);

router.get(
  '/me',
  requiereAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.usuario!.id } });
    if (!user) throw notFound('Usuario no encontrado');
    res.json(toUserDTO(user));
  }),
);

router.patch(
  '/me',
  requiereAuth,
  validarBody(actualizarPerfilSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({ where: { id: req.usuario!.id }, data: req.body });
    res.json(toUserDTO(user));
  }),
);

export default router;
