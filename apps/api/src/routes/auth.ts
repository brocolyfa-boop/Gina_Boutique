import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  MARCA,
  actualizarPerfilSchema,
  cambiarPasswordSchema,
  loginSchema,
  recuperarPasswordSchema,
  refreshSchema,
  registroSchema,
  restablecerPasswordSchema,
  type AuthResponse,
} from '@gina/shared';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';
import { toUserDTO } from '../lib/dto.js';
import { enviarCorreoA } from '../lib/notificaciones.js';
import {
  emitirRefreshToken,
  firmarAccessToken,
  revocarRefreshToken,
  revocarTodasLasSesiones,
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

router.patch(
  '/password',
  requiereAuth,
  validarBody(cambiarPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.usuario!.id } });
    if (!user) throw notFound('Usuario no encontrado');

    const actualOk = await bcrypt.compare(req.body.actual, user.passwordHash);
    if (!actualOk) throw unauthorized('La contraseña actual no es correcta');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(req.body.nueva, 12) },
    });
    res.status(204).end();
  }),
);

/* ------------------------- olvidé mi contraseña -------------------------- */

/** Una hora: suficiente para abrir el correo, corto si alguien más lo ve. */
const VIGENCIA_ENLACE_MS = 60 * 60 * 1000;

const hashEnlace = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Pide el enlace de recuperación.
 *
 * Responde 204 siempre, exista o no la cuenta. Si dijéramos "ese correo no
 * está registrado", cualquiera podría averiguar qué clientes tiene la tienda
 * probando direcciones una por una.
 */
router.post(
  '/recuperar',
  limiteAuth,
  validarBody(recuperarPasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });

    if (user) {
      // Los enlaces viejos dejan de servir: si alguien pidió varios, solo el
      // último vale.
      await prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const token = crypto.randomBytes(32).toString('hex');
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: hashEnlace(token),
          expiresAt: new Date(Date.now() + VIGENCIA_ENLACE_MS),
        },
      });

      const base = env.URL_TIENDA.trim().replace(/\/+$/, '');
      const enlace = `${base}/restablecer?token=${token}`;
      const texto = [
        `Hola ${user.nombre.split(' ')[0]},`,
        '',
        `Pediste recuperar tu contraseña de ${MARCA.nombre}. Abre este enlace para elegir una nueva:`,
        '',
        enlace,
        '',
        'El enlace sirve una sola vez y vence en una hora.',
        'Si no fuiste tú, ignora este correo: tu contraseña sigue igual.',
      ].join('\n');

      try {
        const enviado = await enviarCorreoA(user.email, `Recupera tu contraseña · ${MARCA.nombre}`, texto);
        // Sin correo configurado el enlace sale por los logs del servicio. Es
        // un respaldo para la dueña, no una solución: el cliente no los ve.
        if (!enviado) console.warn(`[RECUPERAR] ${user.email}\n${enlace}`);
      } catch (e) {
        console.error('No se pudo enviar el correo de recuperación:', e);
        console.warn(`[RECUPERAR] ${user.email}\n${enlace}`);
      }
    }

    res.status(204).end();
  }),
);

/** Cambia la contraseña con el token del correo. */
router.post(
  '/restablecer',
  limiteAuth,
  validarBody(restablecerPasswordSchema),
  asyncHandler(async (req, res) => {
    const registro = await prisma.passwordReset.findUnique({
      where: { tokenHash: hashEnlace(req.body.token) },
    });

    if (!registro || registro.usedAt || registro.expiresAt < new Date()) {
      throw badRequest('Este enlace ya no sirve. Pide uno nuevo.');
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: registro.userId },
        data: { passwordHash: await bcrypt.hash(req.body.nueva, 12) },
      }),
      prisma.passwordReset.update({
        where: { id: registro.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Si alguien había entrado con la contraseña vieja, queda fuera. Es el
    // motivo principal por el que una persona recupera su cuenta.
    await revocarTodasLasSesiones(registro.userId);

    res.status(204).end();
  }),
);

export default router;
