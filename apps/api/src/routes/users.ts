import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
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

export default router;
