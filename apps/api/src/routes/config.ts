import { Router } from 'express';
import {
  DEPARTAMENTOS_HONDURAS,
  METODOS_PAGO,
  MONEDA,
  TALLAS_CALZADO,
  TALLAS_ROPA,
  type ConfigPublicaDTO,
} from '@gina/shared';
import { env } from '../env.js';

const router = Router();

/**
 * Config que los clientes leen al arrancar. El costo de envío se sirve desde
 * aquí (COSTO_ENVIO_LPS) para poder subirlo a 70 u 80 lempiras sin republicar
 * la app de Android ni tocar el bundle de la web.
 */
router.get('/', (_req, res) => {
  const config: ConfigPublicaDTO = {
    costoEnvioLps: env.COSTO_ENVIO_LPS,
    moneda: MONEDA,
    pixelpayMode: env.PIXELPAY_MODE,
    metodosPago: [...METODOS_PAGO],
  };
  res.json(config);
});

/** Departamentos con su rango estimado de entrega, para el formulario de envío. */
router.get('/departamentos', (_req, res) => {
  res.json(DEPARTAMENTOS_HONDURAS);
});

router.get('/tallas', (_req, res) => {
  res.json({ ropa: TALLAS_ROPA, calzado: TALLAS_CALZADO });
});

export default router;
