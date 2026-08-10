import { Router } from 'express';
import { cartItemSchema, cartSyncSchema } from '@gina/shared';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import {
  armarCartDTO,
  leerCarrito,
  lineaEquivalente,
  normalizar,
  obtenerOCrearCarrito,
  productoOFalla,
  validarLinea,
} from '../lib/carrito.js';
import { requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

// Todo el carrito exige sesión. Los invitados llevan su carrito en
// localStorage/AsyncStorage y lo suben con /sincronizar al iniciar sesión.
router.use(requiereAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await leerCarrito(req.usuario!.id));
  }),
);

router.post(
  '/items',
  validarBody(cartItemSchema),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const item = req.body;
    const producto = await productoOFalla(item.productoId);
    const talla = normalizar(item.talla);
    const color = normalizar(item.color);

    const cartId = await obtenerOCrearCarrito(userId);

    await prisma.$transaction(async (tx) => {
      const existente = await lineaEquivalente(tx, cartId, producto.id, talla, color);
      // Agregar dos veces lo mismo suma cantidades, y se valida el total
      // resultante contra el stock, no solo lo que viene en esta petición.
      const cantidadFinal = (existente?.cantidad ?? 0) + item.cantidad;
      validarLinea(producto, { ...item, cantidad: cantidadFinal });

      if (existente) {
        await tx.cartItem.update({
          where: { id: existente.id },
          data: { cantidad: cantidadFinal },
        });
      } else {
        await tx.cartItem.create({
          data: { cartId, productoId: producto.id, cantidad: item.cantidad, talla, color },
        });
      }
    });

    res.status(201).json(await leerCarrito(userId));
  }),
);

const cantidadSchema = z.object({ cantidad: z.number().int().min(0).max(50) });

/** cantidad 0 elimina la línea, que es lo que espera un stepper en la UI. */
router.patch(
  '/items/:itemId',
  validarBody(cantidadSchema),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const { cantidad } = req.body;

    const item = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, cart: { userId } },
      include: { producto: true },
    });
    if (!item) throw notFound('Ese producto no está en tu carrito');

    if (cantidad === 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      validarLinea(item.producto, {
        productoId: item.productoId,
        cantidad,
        talla: item.talla,
        color: item.color,
      });
      await prisma.cartItem.update({ where: { id: item.id }, data: { cantidad } });
    }

    res.json(await leerCarrito(userId));
  }),
);

router.delete(
  '/items/:itemId',
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    // deleteMany con el filtro del dueño: así nadie borra líneas de otro carrito.
    const { count } = await prisma.cartItem.deleteMany({
      where: { id: req.params.itemId, cart: { userId } },
    });
    if (count === 0) throw notFound('Ese producto no está en tu carrito');
    res.json(await leerCarrito(userId));
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    await prisma.cartItem.deleteMany({ where: { cart: { userId } } });
    res.json(await leerCarrito(userId));
  }),
);

/**
 * Fusiona el carrito de invitado al iniciar sesión. Las líneas que ya existen
 * se quedan con la cantidad mayor en vez de sumarse: si el cliente tenía 2 en el
 * teléfono y 2 en la web, quiere 2, no 4.
 *
 * Las líneas inválidas (producto agotado, talla que ya no existe) se descartan
 * en silencio en vez de reventar toda la sincronización.
 */
router.post(
  '/sincronizar',
  validarBody(cartSyncSchema),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const cartId = await obtenerOCrearCarrito(userId);
    const descartadas: string[] = [];

    for (const item of req.body.items) {
      const producto = await prisma.product.findUnique({ where: { id: item.productoId } });
      if (!producto) {
        descartadas.push(item.productoId);
        continue;
      }
      const talla = normalizar(item.talla);
      const color = normalizar(item.color);

      try {
        await prisma.$transaction(async (tx) => {
          const existente = await lineaEquivalente(tx, cartId, producto.id, talla, color);
          const cantidadFinal = Math.max(existente?.cantidad ?? 0, item.cantidad);
          validarLinea(producto, { ...item, cantidad: cantidadFinal });

          if (existente) {
            await tx.cartItem.update({
              where: { id: existente.id },
              data: { cantidad: cantidadFinal },
            });
          } else {
            await tx.cartItem.create({
              data: { cartId, productoId: producto.id, cantidad: cantidadFinal, talla, color },
            });
          }
        });
      } catch {
        descartadas.push(producto.nombre);
      }
    }

    const carrito = await leerCarrito(userId);
    res.json({ ...carrito, descartadas });
  }),
);

export { armarCartDTO };
export default router;
