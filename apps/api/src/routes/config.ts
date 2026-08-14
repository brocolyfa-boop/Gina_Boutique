import { Router } from 'express';
import {
  DEPARTAMENTOS_HONDURAS,
  MARCA,
  MONEDA,
  TALLAS_CALZADO,
  TALLAS_ROPA,
  normalizarWhatsApp,
  type ConfigPublicaDTO,
} from '@gina/shared';
import { env } from '../env.js';
import { metodosDisponibles } from '../lib/pagos.js';
import { hayCorreoConfigurado } from '../lib/notificaciones.js';

const router = Router();

/**
 * Config que los clientes leen al arrancar. El costo de envío se sirve desde
 * aquí (COSTO_ENVIO_LPS) para poder subirlo a 70 u 80 lempiras sin republicar
 * la app de Android ni tocar el bundle de la web.
 */
router.get('/', (_req, res) => {
  const disponibles = metodosDisponibles();
  const config: ConfigPublicaDTO & {
    metodosPagoDetalle: Array<{ metodo: string; etiqueta: string; descripcion: string }>;
  } = {
    costoEnvioLps: Math.min(env.tarifasEnvio.tegucigalpa, env.tarifasEnvio.nacional),
    // Se normaliza aquí para que ni la web ni la app tengan que saber que wa.me
    // quiere el número sin signos y con el código de país.
    whatsapp: normalizarWhatsApp(env.TIENDA_WHATSAPP || MARCA.redes.whatsapp),
    tarifasEnvio: env.tarifasEnvio,
    moneda: MONEDA,
    pixelpayMode: env.PIXELPAY_MODE,
    googleClientId: env.GOOGLE_CLIENT_ID,
    correoConfigurado: hayCorreoConfigurado(),
    // Solo los métodos realmente cobrables. Mientras no haya pasarela de
    // tarjeta configurada, el checkout no la ofrece en vez de aceptar una orden
    // que nunca se podría cobrar.
    metodosPago: disponibles.map((p) => p.metodo),
    metodosPagoDetalle: disponibles.map((p) => ({
      metodo: p.metodo,
      etiqueta: p.etiqueta,
      descripcion: p.descripcion,
    })),
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
