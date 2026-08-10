import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  actualizarEstadoOrdenSchema,
  crearOrdenSchema,
  precioFinal,
  redondear,
  type OrdenItemDTO,
} from '@gina/shared';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { forbidden, notFound, unprocessable } from '../lib/errors.js';
import { num, numOrNull, toOrdenDTO } from '../lib/dto.js';
import { normalizar, validarLinea } from '../lib/carrito.js';
import { proveedorDe } from '../lib/pagos.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

router.use(requiereAuth);

/**
 * Crea la orden. Reglas que se aplican acá y no se delegan al cliente:
 *
 * - Los precios se releen de la base. Lo que el cliente diga que cuesta algo se
 *   ignora por completo.
 * - El costo de envío sale de COSTO_ENVIO_LPS, no del body.
 * - El stock se descuenta condicionado (`stock >= cantidad`), así dos compras
 *   simultáneas del último artículo no lo dejan en negativo.
 * - `items` se guarda como snapshot: si mañana cambia el precio o el nombre del
 *   producto, la orden vieja sigue diciendo lo que el cliente compró.
 */
router.post(
  '/',
  validarBody(crearOrdenSchema),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const { items, envio, metodoPago, notas } = req.body;

    // Falla temprano si el método no está habilitado, antes de tocar stock.
    const proveedor = proveedorDe(metodoPago);

    const orden = await prisma.$transaction(async (tx) => {
      const snapshot: OrdenItemDTO[] = [];

      for (const item of items) {
        const producto = await tx.product.findUnique({ where: { id: item.productoId } });
        if (!producto) throw notFound(`Un producto de tu pedido ya no existe`);

        const talla = normalizar(item.talla);
        const color = normalizar(item.color);
        validarLinea(producto, { ...item, talla, color });

        const unitario = precioFinal(num(producto.precio), numOrNull(producto.precioOferta));

        // Descuento condicionado: si otro cliente se llevó las últimas unidades
        // entre la validación y este update, count queda en 0 y abortamos todo.
        const { count } = await tx.product.updateMany({
          where: { id: producto.id, stock: { gte: item.cantidad } },
          data: { stock: { decrement: item.cantidad } },
        });
        if (count === 0) {
          throw unprocessable(
            `"${producto.nombre}" se agotó mientras completabas tu pedido. Quita el producto e intenta de nuevo.`,
          );
        }

        snapshot.push({
          productoId: producto.id,
          nombre: producto.nombre,
          precioUnitario: unitario,
          cantidad: item.cantidad,
          talla,
          color,
          imagen: producto.imagenes[0] ?? null,
        });
      }

      const subtotal = redondear(
        snapshot.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0),
      );
      const costoEnvio = env.COSTO_ENVIO_LPS;

      const creada = await tx.order.create({
        data: {
          userId,
          items: snapshot as unknown as Prisma.InputJsonValue,
          subtotal,
          costoEnvio,
          total: redondear(subtotal + costoEnvio),
          direccionEnvio: envio.direccionCompleta,
          departamento: envio.departamento,
          municipio: envio.municipio,
          referencia: normalizar(envio.referencia),
          telefonoContacto: envio.telefonoContacto,
          notas: normalizar(notas),
          metodoPago,
        },
      });

      // El carrito se vacía junto con la orden: si algo falla, la transacción
      // revierte y el cliente no se queda sin carrito y sin orden.
      await tx.cartItem.deleteMany({ where: { cart: { userId } } });

      return creada;
    });

    // El cobro va FUERA de la transacción: una llamada de red no debe mantener
    // abierta una transacción con filas de stock bloqueadas.
    const cobro = await proveedor.cobrar({
      montoLps: num(orden.total),
      token: req.body.pagoToken,
      ordenRef: orden.id,
    });

    const actualizada = cobro.cobrado
      ? await prisma.order.update({
          where: { id: orden.id },
          data: { estado: 'pagado', pixelpayTransactionId: cobro.transaccionId },
        })
      : orden;

    res.status(201).json(toOrdenDTO(actualizada));
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const ordenes = await prisma.order.findMany({
      where: { userId: req.usuario!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(ordenes.map(toOrdenDTO));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orden = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!orden) throw notFound('Orden no encontrada');
    // Un cliente solo ve lo suyo; el admin ve cualquiera.
    if (orden.userId !== req.usuario!.id && req.usuario!.rol !== 'admin') {
      throw forbidden('Esa orden no es tuya');
    }
    res.json(toOrdenDTO(orden));
  }),
);

/** Cancelar devuelve el stock. Solo se puede antes de que el pedido salga. */
router.post(
  '/:id/cancelar',
  asyncHandler(async (req, res) => {
    const actualizada = await prisma.$transaction(async (tx) => {
      const orden = await tx.order.findUnique({ where: { id: req.params.id } });
      if (!orden) throw notFound('Orden no encontrada');
      if (orden.userId !== req.usuario!.id && req.usuario!.rol !== 'admin') {
        throw forbidden('Esa orden no es tuya');
      }
      if (orden.estado === 'cancelado') throw unprocessable('Esa orden ya está cancelada');
      if (orden.estado !== 'pendiente') {
        throw unprocessable(
          'El pedido ya está en camino. Escríbenos por WhatsApp para gestionar la devolución.',
        );
      }

      for (const item of orden.items as unknown as OrdenItemDTO[]) {
        await tx.product.updateMany({
          where: { id: item.productoId },
          data: { stock: { increment: item.cantidad } },
        });
      }

      return tx.order.update({ where: { id: orden.id }, data: { estado: 'cancelado' } });
    });

    res.json(toOrdenDTO(actualizada));
  }),
);

/* ---------------------------------- admin --------------------------------- */

router.get(
  '/admin/todas',
  requiereAdmin,
  asyncHandler(async (req, res) => {
    const estado = req.query.estado as Prisma.OrderWhereInput['estado'] | undefined;
    const ordenes = await prisma.order.findMany({
      where: estado ? { estado } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(ordenes.map(toOrdenDTO));
  }),
);

router.patch(
  '/:id/estado',
  requiereAdmin,
  validarBody(actualizarEstadoOrdenSchema),
  asyncHandler(async (req, res) => {
    const orden = await prisma.order.update({
      where: { id: req.params.id },
      data: { estado: req.body.estado },
    });
    res.json(toOrdenDTO(orden));
  }),
);

/** Dashboard: ventas del día y de la semana, y los más vendidos. */
router.get(
  '/admin/resumen',
  requiereAdmin,
  asyncHandler(async (_req, res) => {
    const ahora = new Date();
    const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const inicioSemana = new Date(inicioDia.getTime() - 6 * 24 * 60 * 60 * 1000);

    // Las canceladas no cuentan como venta.
    const vendidas: Prisma.OrderWhereInput = { estado: { not: 'cancelado' } };

    const [hoy, semana, pendientes, ultimas] = await Promise.all([
      prisma.order.aggregate({
        where: { ...vendidas, createdAt: { gte: inicioDia } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.aggregate({
        where: { ...vendidas, createdAt: { gte: inicioSemana } },
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.count({ where: { estado: 'pendiente' } }),
      prisma.order.findMany({
        where: vendidas,
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { items: true },
      }),
    ]);

    // Los más vendidos se cuentan sobre el snapshot de las últimas órdenes: el
    // producto puede haberse borrado y aun así debe aparecer en el ranking.
    const conteo = new Map<string, { nombre: string; unidades: number }>();
    for (const orden of ultimas) {
      for (const item of orden.items as unknown as OrdenItemDTO[]) {
        const actual = conteo.get(item.productoId) ?? { nombre: item.nombre, unidades: 0 };
        actual.unidades += item.cantidad;
        conteo.set(item.productoId, actual);
      }
    }
    const masVendidos = [...conteo.entries()]
      .map(([productoId, v]) => ({ productoId, ...v }))
      .sort((a, b) => b.unidades - a.unidades)
      .slice(0, 10);

    res.json({
      hoy: { ordenes: hoy._count, ventasLps: num(hoy._sum.total) },
      semana: { ordenes: semana._count, ventasLps: num(semana._sum.total) },
      ordenesPendientes: pendientes,
      masVendidos,
    });
  }),
);

export default router;
