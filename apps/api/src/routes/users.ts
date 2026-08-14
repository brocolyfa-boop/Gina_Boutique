import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { mensajeCodigoWhatsApp } from '@gina/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, queryValidado, validarQuery } from '../middleware/validate.js';

const router = Router();

const listadoSchema = z.object({
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/**
 * Clientes registrados, con lo que ha comprado cada uno.
 *
 * Nunca devuelve `passwordHash`: el `select` es explícito justamente para que
 * agregar una columna sensible al modelo no la filtre sola por aquí.
 */
router.get(
  '/admin',
  requiereAuth,
  requiereAdmin,
  validarQuery(listadoSchema),
  asyncHandler(async (_req, res) => {
    const { q, limit } = queryValidado<z.infer<typeof listadoSchema>>(res);

    const usuarios = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { nombre: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        nombre: true,
        email: true,
        telefono: true,
        rol: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Las compras se cuentan aparte y en una sola consulta: un `_count` por
    // relación no puede excluir las órdenes canceladas ni sumar los totales.
    const compras = await prisma.order.groupBy({
      by: ['userId'],
      where: { userId: { in: usuarios.map((u) => u.id) }, estado: { not: 'cancelado' } },
      _sum: { total: true },
      _count: true,
    });
    const porUsuario = new Map(compras.map((c) => [c.userId, c]));

    res.json(
      usuarios.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        pedidos: porUsuario.get(u.id)?._count ?? 0,
        gastado: Number(porUsuario.get(u.id)?._sum.total ?? 0),
      })),
    );
  }),
);

/**
 * Solicitudes de recuperación pendientes de mandar.
 *
 * El código no aparece aquí y no puede aparecer: en la base va hasheado, que es
 * justamente lo que hace que leer la base no alcance para entrar a las cuentas.
 * Para mandárselo al cliente se genera uno nuevo con la ruta de abajo.
 */
router.get(
  '/admin/recuperaciones',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (_req, res) => {
    const pendientes = await prisma.passwordReset.findMany({
      where: {
        usedAt: null,
        enviadoAt: null,
        codigoHash: { not: null },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        telefono: true,
        createdAt: true,
        expiresAt: true,
        user: { select: { nombre: true, email: true } },
      },
    });

    res.json(
      pendientes.map((p) => ({
        id: p.id,
        telefono: p.telefono,
        nombre: p.user.nombre,
        email: p.user.email,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
    );
  }),
);

/**
 * Genera un código nuevo para una solicitud y lo devuelve **una sola vez**.
 *
 * Es la forma de que la tienda pueda mandarlo sin que el código quede guardado
 * en claro en ningún lado: se crea, se entrega en esta respuesta, y de él solo
 * queda el hash. Si la dueña cierra la ventana sin copiarlo, aprieta el botón
 * otra vez y se genera otro; el anterior deja de servir.
 *
 * Solo administradores, y el código viaja a un número que ya estaba registrado
 * en la solicitud: no se acepta un teléfono nuevo por parámetro, que sería una
 * forma de desviar la recuperación de otra persona a un celular propio.
 */
router.post(
  '/admin/recuperaciones/:id/codigo',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (req, res) => {
    const solicitud = await prisma.passwordReset.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { nombre: true } } },
    });

    if (!solicitud || solicitud.usedAt || !solicitud.telefono) {
      throw notFound('Esa solicitud ya no está disponible');
    }

    const codigo = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

    await prisma.passwordReset.update({
      where: { id: solicitud.id },
      data: {
        codigoHash: crypto.createHash('sha256').update(codigo).digest('hex'),
        // Se reinician los intentos y el reloj: es un código nuevo, no el viejo.
        intentos: 0,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        enviadoAt: new Date(),
      },
    });

    res.json({
      telefono: solicitud.telefono,
      mensaje: mensajeCodigoWhatsApp(solicitud.user.nombre, codigo),
    });
  }),
);

export default router;
