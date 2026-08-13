import { Router } from 'express';
import { z } from 'zod';
import { cloudinaryConfigurado, firmarSubida } from '../lib/cloudinary.js';
import { requiereAdmin, requiereAuth } from '../middleware/auth.js';
import { asyncHandler, validarBody } from '../middleware/validate.js';

const router = Router();

router.use(requiereAuth, requiereAdmin);

/** Carpetas permitidas. Una lista cerrada evita que se escriba en cualquier ruta. */
const CARPETAS = ['productos', 'categorias', 'promociones'] as const;

const firmaSchema = z.object({
  carpeta: z.enum(CARPETAS).default('productos'),
});

/**
 * Devuelve una firma para que el navegador suba la imagen directo a Cloudinary.
 * Solo para administradores: firmar es autorizar una escritura en la cuenta.
 */
router.post(
  '/firma',
  validarBody(firmaSchema),
  asyncHandler(async (req, res) => {
    res.json(firmarSubida(`gina-boutique/${req.body.carpeta}`));
  }),
);

/** Le dice al panel si puede ofrecer la subida o debe pedir una URL a mano. */
router.get(
  '/estado',
  asyncHandler(async (_req, res) => {
    res.json({ disponible: cloudinaryConfigurado(), carpetas: CARPETAS });
  }),
);

export default router;
