import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  listarProductosQuerySchema,
  productoInputSchema,
  productoUpdateSchema,
  type ListarProductosQuery,
  type Paginado,
  type ProductoDTO,
} from '@gina/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { toProductoDTO } from '../lib/dto.js';
import { promocionesVigentes } from '../lib/promociones.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, queryValidado, validarBody, validarQuery } from '../middleware/validate.js';

const router = Router();

const ORDENES: Record<ListarProductosQuery['orden'], Prisma.ProductOrderByWithRelationInput> = {
  nuevos: { createdAt: 'desc' },
  precio_asc: { precio: 'asc' },
  precio_desc: { precio: 'desc' },
  nombre: { nombre: 'asc' },
};

/**
 * Catálogo paginado con filtros. Nunca devuelve todo el catálogo de una vez:
 * web usa paginación y mobile scroll infinito sobre el mismo endpoint.
 */
router.get(
  '/',
  validarQuery(listarProductosQuerySchema),
  asyncHandler(async (_req, res) => {
    const q = queryValidado<ListarProductosQuery>(res);

    const where: Prisma.ProductWhereInput = { activo: true };
    if (q.q) {
      where.OR = [
        { nombre: { contains: q.q, mode: 'insensitive' } },
        { descripcion: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    // La categoría se acepta por slug o por id, para URLs bonitas en la web.
    if (q.categoria) where.categoria = { OR: [{ slug: q.categoria }, { id: q.categoria }] };
    if (q.subcategoria) where.subcategoria = { equals: q.subcategoria, mode: 'insensitive' };
    if (q.talla) where.tallas = { has: q.talla };
    if (q.color) where.colores = { has: q.color };
    if (q.destacado) where.destacado = true;
    if (q.enOferta) {
      // "En oferta" es tener precio rebajado Y estar dentro de la ventana. Sin
      // las fechas, el catálogo seguiría anunciando ofertas ya vencidas.
      const ahora = new Date();
      where.precioOferta = { not: null };
      where.AND = [
        { OR: [{ ofertaInicio: null }, { ofertaInicio: { lte: ahora } }] },
        { OR: [{ ofertaFin: null }, { ofertaFin: { gte: ahora } }] },
      ];
    }
    if (q.precioMin != null || q.precioMax != null) {
      where.precio = {
        ...(q.precioMin != null && { gte: q.precioMin }),
        ...(q.precioMax != null && { lte: q.precioMax }),
      };
    }

    const [total, productos, promos] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { categoria: true },
        orderBy: ORDENES[q.orden],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      promocionesVigentes(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    const respuesta: Paginado<ProductoDTO> = {
      data: productos.map((p) => toProductoDTO(p, promos)),
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasNextPage: q.page < totalPages,
    };
    res.json(respuesta);
  }),
);

/** Autocompletado del buscador: solo nombres, respuesta mínima. */
router.get(
  '/sugerencias',
  asyncHandler(async (req, res) => {
    const termino = String(req.query.q ?? '').trim();
    if (termino.length < 2) {
      res.json([]);
      return;
    }
    const productos = await prisma.product.findMany({
      where: { activo: true, nombre: { contains: termino, mode: 'insensitive' } },
      select: { id: true, nombre: true, imagenes: true },
      take: 8,
      orderBy: { nombre: 'asc' },
    });
    res.json(
      productos.map((p) => ({ id: p.id, nombre: p.nombre, imagen: p.imagenes[0] ?? null })),
    );
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const producto = await prisma.product.findFirst({
      where: { id: req.params.id, activo: true },
      include: { categoria: true },
    });
    if (!producto) throw notFound('Producto no encontrado');

    // Relacionados de la misma categoría, para la ficha de producto.
    const [relacionados, promos] = await Promise.all([
      prisma.product.findMany({
        where: { categoriaId: producto.categoriaId, activo: true, id: { not: producto.id } },
        include: { categoria: true },
        take: 8,
        orderBy: { createdAt: 'desc' },
      }),
      promocionesVigentes(),
    ]);

    res.json({
      ...toProductoDTO(producto, promos),
      relacionados: relacionados.map((r) => toProductoDTO(r, promos)),
    });
  }),
);

/* ---------------------------------- admin --------------------------------- */

/** Incluye inactivos: el panel necesita ver y reactivar productos apagados. */
router.get(
  '/admin/todos',
  requiereAuth,
  requiereAdmin,
  validarQuery(listarProductosQuerySchema),
  asyncHandler(async (_req, res) => {
    const q = queryValidado<ListarProductosQuery>(res);
    const where: Prisma.ProductWhereInput = q.q
      ? { nombre: { contains: q.q, mode: 'insensitive' } }
      : {};

    const [total, productos, promos] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: { categoria: true },
        orderBy: ORDENES[q.orden],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      promocionesVigentes(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / q.limit));
    res.json({
      data: productos.map((p) => toProductoDTO(p, promos)),
      page: q.page,
      limit: q.limit,
      total,
      totalPages,
      hasNextPage: q.page < totalPages,
    } satisfies Paginado<ProductoDTO>);
  }),
);

router.post(
  '/',
  requiereAuth,
  requiereAdmin,
  validarBody(productoInputSchema),
  asyncHandler(async (req, res) => {
    const producto = await prisma.product.create({
      data: req.body,
      include: { categoria: true },
    });
    res.status(201).json(toProductoDTO(producto, await promocionesVigentes()));
  }),
);

router.patch(
  '/:id',
  requiereAuth,
  requiereAdmin,
  validarBody(productoUpdateSchema),
  asyncHandler(async (req, res) => {
    const producto = await prisma.product.update({
      where: { id: req.params.id },
      data: req.body,
      include: { categoria: true },
    });
    res.json(toProductoDTO(producto, await promocionesVigentes()));
  }),
);

/** Baja lógica: las órdenes ya emitidas siguen apuntando al producto. */
router.delete(
  '/:id',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (req, res) => {
    await prisma.product.update({ where: { id: req.params.id }, data: { activo: false } });
    res.status(204).end();
  }),
);

export default router;
