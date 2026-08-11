import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  PERIODOS_DASHBOARD,
  actualizarEstadoOrdenSchema,
  costoEnvioPara,
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
import { authOpcional, requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, queryValidado, validarBody, validarQuery } from '../middleware/validate.js';
import { construirDashboard } from '../lib/dashboard.js';
import { notificarPedidoNuevo } from '../lib/notificaciones.js';

const router = Router();

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
  authOpcional,
  validarBody(crearOrdenSchema),
  asyncHandler(async (req, res) => {
    // Se puede comprar sin cuenta: `userId` queda nulo y el contacto del pedido
    // son el nombre y el teléfono que vienen en la dirección de envío.
    const userId = req.usuario?.id ?? null;
    const { items, envio, metodoPago, notas, emailCliente } = req.body;

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

        const unitario = precioFinal(num(producto.precio), numOrNull(producto.precioOferta), {
          inicio: producto.ofertaInicio,
          fin: producto.ofertaFin,
        });

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
      // El envío sale de la zona de entrega, no de lo que mande el cliente:
      // dentro de Tegucigalpa la mensajería cobra menos que al resto del país.
      const costoEnvio = costoEnvioPara(envio.departamento, envio.municipio, env.tarifasEnvio);

      const creada = await tx.order.create({
        data: {
          userId,
          nombreCliente: envio.nombreCompleto,
          emailCliente: normalizar(emailCliente),
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
      // revierte y el cliente no se queda sin carrito y sin orden. El invitado
      // no tiene carrito en la base; el suyo vive en el navegador.
      if (userId) await tx.cartItem.deleteMany({ where: { cart: { userId } } });

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

    const dto = toOrdenDTO(actualizada);

    // El aviso no se espera: el cliente no tiene por qué mirar una pantalla de
    // carga mientras hablamos con Meta, y si el aviso falla el pedido ya está
    // guardado igual.
    void notificarPedidoNuevo(dto);

    res.status(201).json(dto);
  }),
);

/**
 * Seguimiento de un pedido de invitado: número más teléfono.
 *
 * No es un secreto criptográfico, pero adivinar los dos a la vez no es viable
 * y no obliga al comprador a crearse una cuenta solo para ver su pedido.
 */
router.get(
  '/seguimiento/:numero',
  asyncHandler(async (req, res) => {
    const telefono = String(req.query.telefono ?? '').replace(/\D/g, '');
    const secuencia = Number(String(req.params.numero).replace(/\D/g, ''));

    if (!telefono || !Number.isInteger(secuencia) || secuencia <= 0) {
      throw notFound('No encontramos ese pedido');
    }

    const orden = await prisma.order.findUnique({ where: { secuencia } });
    // Mismo mensaje si no existe o si el teléfono no coincide: distinguirlos
    // permitiría averiguar qué números de pedido existen.
    if (!orden || orden.telefonoContacto.replace(/\D/g, '') !== telefono) {
      throw notFound('No encontramos ese pedido');
    }

    res.json(toOrdenDTO(orden));
  }),
);

router.get(
  '/',
  requiereAuth,
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
  requiereAuth,
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
  requiereAuth,
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
  requiereAuth,
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
  requiereAuth,
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

const dashboardQuerySchema = z.object({
  periodo: z.enum(PERIODOS_DASHBOARD).default('30d'),
  departamento: z.string().trim().min(1).optional(),
});

/**
 * Panel del supervisor: ventas por zona, evolución diaria, más vendidos y stock
 * bajo. Todo se agrega en la base, no en el navegador.
 */
router.get(
  '/admin/dashboard',
  requiereAuth,
  requiereAdmin,
  validarQuery(dashboardQuerySchema),
  asyncHandler(async (_req, res) => {
    const q = queryValidado<z.infer<typeof dashboardQuerySchema>>(res);
    res.json(await construirDashboard(q.periodo, q.departamento));
  }),
);

/** Resumen corto. Se mantiene por compatibilidad con la vista simple. */
router.get(
  '/admin/resumen',
  requiereAuth,
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
