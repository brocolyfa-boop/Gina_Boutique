import { Router } from 'express';
import { addressInputSchema } from '@gina/shared';
import { prisma } from '../prisma.js';
import { notFound } from '../lib/errors.js';
import { normalizar } from '../lib/carrito.js';
import { requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

router.use(requiereAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const direcciones = await prisma.address.findMany({
      where: { userId: req.usuario!.id },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(direcciones);
  }),
);

/** Si se marca como principal, se desmarca la anterior en la misma transacción. */
router.post(
  '/',
  validarBody(addressInputSchema),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const datos = req.body;

    const direccion = await prisma.$transaction(async (tx) => {
      const esLaPrimera = (await tx.address.count({ where: { userId } })) === 0;
      const principal = datos.esPrincipal || esLaPrimera;

      if (principal) {
        await tx.address.updateMany({ where: { userId }, data: { esPrincipal: false } });
      }

      return tx.address.create({
        data: {
          userId,
          alias: datos.alias,
          nombreCompleto: datos.nombreCompleto,
          telefonoContacto: datos.telefonoContacto,
          direccionCompleta: datos.direccionCompleta,
          departamento: datos.departamento,
          municipio: datos.municipio,
          referencia: normalizar(datos.referencia),
          esPrincipal: principal,
        },
      });
    });

    res.status(201).json(direccion);
  }),
);

router.patch(
  '/:id',
  validarBody(addressInputSchema.partial()),
  asyncHandler(async (req, res) => {
    const userId = req.usuario!.id;
    const datos = req.body;

    const direccion = await prisma.$transaction(async (tx) => {
      const existente = await tx.address.findFirst({ where: { id: req.params.id, userId } });
      if (!existente) throw notFound('Dirección no encontrada');

      if (datos.esPrincipal) {
        await tx.address.updateMany({ where: { userId }, data: { esPrincipal: false } });
      }

      return tx.address.update({ where: { id: existente.id }, data: datos });
    });

    res.json(direccion);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { count } = await prisma.address.deleteMany({
      where: { id: req.params.id, userId: req.usuario!.id },
    });
    if (count === 0) throw notFound('Dirección no encontrada');
    res.status(204).end();
  }),
);

export default router;
