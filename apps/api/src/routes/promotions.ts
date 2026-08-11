import { Router } from 'express';
import { promocionInputSchema, promocionUpdateSchema } from '@gina/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { toPromocionDTO } from '../lib/dto.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';
import { invalidarPromociones } from '../lib/promociones.js';

const router = Router();

/** Promos vigentes ahora mismo — alimenta el banner y el countdown del home. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const ahora = new Date();
    const promos = await prisma.promotion.findMany({
      where: { activo: true, fechaInicio: { lte: ahora }, fechaFin: { gte: ahora } },
      orderBy: { fechaFin: 'asc' },
    });
    res.json(promos.map(toPromocionDTO));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const promo = await prisma.promotion.findUnique({ where: { id: req.params.id } });
    if (!promo) throw notFound('Promoción no encontrada');
    res.json(toPromocionDTO(promo));
  }),
);

/* ---------------------------------- admin --------------------------------- */

router.get(
  '/admin/todas',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (_req, res) => {
    const promos = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(promos.map(toPromocionDTO));
  }),
);

router.post(
  '/',
  requiereAuth,
  requiereAdmin,
  validarBody(promocionInputSchema),
  asyncHandler(async (req, res) => {
    const promo = await prisma.promotion.create({ data: req.body });
    // Sin esto, una promoción recién creada tardaría hasta medio minuto en
    // aplicarse y quien la creó pensaría que no funciona.
    invalidarPromociones();
    res.status(201).json(toPromocionDTO(promo));
  }),
);

router.patch(
  '/:id',
  requiereAuth,
  requiereAdmin,
  validarBody(promocionUpdateSchema),
  asyncHandler(async (req, res) => {
    const promo = await prisma.promotion.update({ where: { id: req.params.id }, data: req.body });
    invalidarPromociones();
    res.json(toPromocionDTO(promo));
  }),
);

router.delete(
  '/:id',
  requiereAuth,
  requiereAdmin,
  asyncHandler(async (req, res) => {
    await prisma.promotion.delete({ where: { id: req.params.id } });
    invalidarPromociones();
    res.status(204).end();
  }),
);

export default router;
