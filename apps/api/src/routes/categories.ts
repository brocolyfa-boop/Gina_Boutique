import { Router } from 'express';
import { categoriaInputSchema } from '@gina/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { toCategoriaDTO } from '../lib/dto.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

/** Público: listado para el home y el menú de navegación. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const categorias = await prisma.category.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { _count: { select: { products: { where: { activo: true } } } } },
    });
    res.json(categorias.map((c) => toCategoriaDTO(c, c._count.products)));
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const categoria = await prisma.category.findUnique({
      where: { slug: req.params.slug },
      include: { _count: { select: { products: { where: { activo: true } } } } },
    });
    if (!categoria) throw notFound('Categoría no encontrada');
    res.json(toCategoriaDTO(categoria, categoria._count.products));
  }),
);

/* ---------------------------------- admin --------------------------------- */

router.post(
  '/',
  requiereAuth,
  requiereAdmin,
  validarBody(categoriaInputSchema),
  asyncHandler(async (req, res) => {
    const categoria = await prisma.category.create({ data: req.body });
    res.status(201).json(toCategoriaDTO(categoria));
  }),
);

router.patch(
  '/:id',
  requiereAuth,
  requiereAdmin,
  validarBody(categoriaInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const categoria = await prisma.category.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(toCategoriaDTO(categoria));
  }),
);

router.delete(
  '/:id',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (req, res) => {
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

export default router;
