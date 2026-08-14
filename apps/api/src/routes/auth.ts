import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import {
  MARCA,
  actualizarPerfilSchema,
  cambiarPasswordSchema,
  googleLoginSchema,
  loginSchema,
  mensajeCodigoWhatsApp,
  normalizarWhatsApp,
  recuperarPasswordSchema,
  recuperarPorWhatsAppSchema,
  refreshSchema,
  registroSchema,
  restablecerConCodigoSchema,
  restablecerPasswordSchema,
  type AuthResponse,
} from '@gina/shared';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import { badRequest, conflict, notFound, unauthorized } from '../lib/errors.js';
import { toUserDTO } from '../lib/dto.js';
import { enviarCorreoA, enviarWhatsAppA } from '../lib/notificaciones.js';
import { verificarTokenGoogle } from '../lib/google.js';
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
    // Una cuenta creada con Google no tiene hash: nunca entra por aquí, y se
    // comprueba antes de llamar a bcrypt, que con null lanzaría un 500.
    const passwordOk =
      user?.passwordHash != null ? await bcrypt.compare(password, user.passwordHash) : false;
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

    /*
      Quien entró con Google no tiene contraseña que confirmar. Pedirle la
      "actual" es imposible de cumplir, así que se le manda al camino que sí
      puede completar: el correo de recuperación le deja poner la primera.
    */
    if (user.passwordHash == null) {
      throw badRequest(
        'Tu cuenta entra con Google y todavía no tiene contraseña. Usa "Olvidé mi contraseña" para crear una.',
      );
    }

    const actualOk = await bcrypt.compare(req.body.actual, user.passwordHash);
    if (!actualOk) throw unauthorized('La contraseña actual no es correcta');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(req.body.nueva, 12) },
    });
    res.status(204).end();
  }),
);

/* ---------------------------- entrar con Google --------------------------- */

/**
 * Entra (o se registra) con una cuenta de Google.
 *
 * Tres casos, en este orden:
 *
 *  1. Ya entró antes con Google → se reconoce por su `googleId`.
 *  2. Tiene cuenta con contraseña y el mismo correo → se enlaza. Es seguro
 *     porque `verificarTokenGoogle` exige que Google confirme el correo, así
 *     que la persona demostró ser dueña de esa dirección.
 *  3. No existe → se le crea la cuenta sin contraseña.
 */
router.post(
  '/google',
  limiteAuth,
  validarBody(googleLoginSchema),
  asyncHandler(async (req, res) => {
    const { googleId, email, nombre } = await verificarTokenGoogle(req.body.credential);

    let user = await prisma.user.findUnique({ where: { googleId } });

    if (!user) {
      const porCorreo = await prisma.user.findUnique({ where: { email } });
      user = porCorreo
        ? await prisma.user.update({ where: { id: porCorreo.id }, data: { googleId } })
        : await prisma.user.create({ data: { nombre, email, googleId, passwordHash: null } });
    }

    const respuesta: AuthResponse = {
      user: toUserDTO(user),
      accessToken: firmarAccessToken({ sub: user.id, rol: user.rol }),
      refreshToken: await emitirRefreshToken(user.id),
    };
    res.json(respuesta);
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

/* --------------------- recuperación por WhatsApp -------------------------- */

/** 10 minutos: un código corto no debe andar vivo por ahí una hora. */
const VIGENCIA_CODIGO_MS = 10 * 60 * 1000;
/** Cinco intentos y el código se quema. Un millón de combinaciones no es mucho. */
const INTENTOS_MAXIMOS = 5;

/**
 * Freno específico para los códigos.
 *
 * El límite general de auth (20 cada 15 min) es demasiado holgado aquí: con 20
 * intentos por ventana y sin más control, probar códigos ajenos sale barato.
 */
const limiteCodigo = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { message: 'Demasiados intentos, prueba en unos minutos', code: 'RATE_LIMIT' } },
});

/**
 * Busca la cuenta por número de teléfono.
 *
 * `telefono` se guarda como lo escribió la persona (9999-9999, +504 9999 9999),
 * así que la comparación se hace sobre los dígitos, no sobre el texto.
 *
 * Devuelve null si hay más de una cuenta con ese número: pasa en familias que
 * comparten teléfono, y ahí no hay forma de saber cuál cuenta recuperar.
 * Entregar la equivocada sería darle a alguien la cuenta de otro.
 */
async function cuentaPorTelefono(telefono: string) {
  const digitos = normalizarWhatsApp(telefono);
  const candidatos = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users
    WHERE right(regexp_replace(coalesce(telefono, ''), '\D', '', 'g'), 8) = right(${digitos}, 8)
      AND coalesce(telefono, '') <> ''
    LIMIT 2
  `;
  if (candidatos.length !== 1 || !candidatos[0]) return null;
  return prisma.user.findUnique({ where: { id: candidatos[0].id } });
}

const hashCodigo = (codigo: string) => crypto.createHash('sha256').update(codigo).digest('hex');

/**
 * Pide el código por WhatsApp.
 *
 * Responde 204 siempre, haya cuenta o no: si dijéramos "ese número no tiene
 * cuenta", cualquiera podría averiguar qué teléfonos son clientes probando.
 */
router.post(
  '/recuperar-whatsapp',
  limiteCodigo,
  validarBody(recuperarPorWhatsAppSchema),
  asyncHandler(async (req, res) => {
    const user = await cuentaPorTelefono(req.body.telefono);

    if (user) {
      // Los códigos anteriores se queman: si pidió varios, solo vale el último.
      await prisma.passwordReset.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // randomInt es criptográficamente seguro; Math.random es predecible y no
      // sirve para nada que proteja una cuenta.
      const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const destino = normalizarWhatsApp(req.body.telefono);

      const registro = await prisma.passwordReset.create({
        data: {
          userId: user.id,
          codigoHash: hashCodigo(codigo),
          telefono: destino,
          expiresAt: new Date(Date.now() + VIGENCIA_CODIGO_MS),
        },
      });

      // Con credenciales de Meta el código sale solo; sin ellas queda pendiente
      // en el panel para que la tienda lo mande a mano.
      const texto = mensajeCodigoWhatsApp(user.nombre, codigo);
      const enviado = await enviarWhatsAppA(destino, texto).catch((e) => {
        console.error('No se pudo mandar el código por WhatsApp:', e);
        return false;
      });

      if (enviado) {
        await prisma.passwordReset.update({
          where: { id: registro.id },
          data: { enviadoAt: new Date() },
        });
      } else {
        // El código no se escribe en los logs: quien los lea podría entrar a la
        // cuenta. La tienda lo ve en el panel, que exige ser administrador.
        console.warn(`[RECUPERAR] código pendiente de enviar a ${destino}`);
      }
    }

    res.status(204).end();
  }),
);

/** Canjea el código por una contraseña nueva. */
router.post(
  '/restablecer-codigo',
  limiteCodigo,
  validarBody(restablecerConCodigoSchema),
  asyncHandler(async (req, res) => {
    const destino = normalizarWhatsApp(req.body.telefono);

    const registro = await prisma.passwordReset.findFirst({
      where: { telefono: destino, usedAt: null, codigoHash: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    // Mismo mensaje para "no hay código", "venció" y "está mal": distinguirlos
    // le diría a quien prueba si el número tiene una recuperación en curso.
    const invalido = () => badRequest('El código no es correcto o ya venció. Pide uno nuevo.');

    if (!registro || registro.expiresAt < new Date()) throw invalido();

    if (registro.intentos >= INTENTOS_MAXIMOS) {
      await prisma.passwordReset.update({
        where: { id: registro.id },
        data: { usedAt: new Date() },
      });
      throw badRequest('Demasiados intentos con este código. Pide uno nuevo.');
    }

    if (registro.codigoHash !== hashCodigo(req.body.codigo)) {
      await prisma.passwordReset.update({
        where: { id: registro.id },
        data: { intentos: { increment: 1 } },
      });
      throw invalido();
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

    await revocarTodasLasSesiones(registro.userId);
    res.status(204).end();
  }),
);

export default router;
