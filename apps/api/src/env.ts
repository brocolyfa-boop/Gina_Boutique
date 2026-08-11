import { z } from 'zod';
import { TARIFAS_ENVIO_FALLBACK } from '@gina/shared';

/**
 * Validamos el entorno al arrancar: es mejor que el servicio no suba en Railway
 * que descubrir a mitad de un checkout que faltaba PIXELPAY_API_KEY.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL (cópiala del plugin de Postgres)'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  PIXELPAY_API_KEY: z.string().default(''),
  PIXELPAY_API_SECRET: z.string().default(''),
  PIXELPAY_MODE: z.enum(['sandbox', 'production']).default('sandbox'),
  CLOUDINARY_URL: z.string().default(''),
  PORT: z.coerce.number().int().positive().default(3000),
  // Tarifas de la mensajería. Las dos específicas mandan; COSTO_ENVIO_LPS queda
  // como respaldo para despliegues viejos que solo tengan esa.
  COSTO_ENVIO_LPS: z.coerce.number().nonnegative().optional(),
  COSTO_ENVIO_TEGUCIGALPA_LPS: z.coerce.number().nonnegative().optional(),
  COSTO_ENVIO_NACIONAL_LPS: z.coerce.number().nonnegative().optional(),
  // Se incluyen las variantes con 127.0.0.1: el navegador manda cabecera
  // Origin en los POST aunque sean del mismo origen, y localhost y 127.0.0.1
  // son orígenes distintos para esa comprobación.
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081',
    ),
  /**
   * Aviso de pedido nuevo. Todo opcional: sin nada configurado el resumen sale
   * por consola y queda en los logs de Railway.
   */
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_PHONE_ID: z.string().default(''),
  /** A quién se le avisa, en formato internacional sin signos (50499998888). */
  WHATSAPP_DESTINO: z.string().default(''),
  RESEND_API_KEY: z.string().default(''),
  NOTIFICAR_EMAIL: z.string().default(''),
  NOTIFICAR_EMAIL_DESDE: z.string().default('Gina Boutique <onboarding@resend.dev>'),
  /** Número público de la tienda, el del botón de WhatsApp de la web. */
  TIENDA_WHATSAPP: z.string().default(''),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DIAS: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalles = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error(`Configuración inválida en el entorno:\n${detalles.join('\n')}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProd: raw.NODE_ENV === 'production',
  // Sin variables puestas se usan las tarifas reales de la mensajería (90
  // dentro de Tegucigalpa, 120 al resto del país). Antes ambas caían en un
  // único valor por defecto y la capital terminaba pagando de más.
  tarifasEnvio: {
    tegucigalpa:
      raw.COSTO_ENVIO_TEGUCIGALPA_LPS ?? raw.COSTO_ENVIO_LPS ?? TARIFAS_ENVIO_FALLBACK.tegucigalpa,
    nacional: raw.COSTO_ENVIO_NACIONAL_LPS ?? raw.COSTO_ENVIO_LPS ?? TARIFAS_ENVIO_FALLBACK.nacional,
  },
  // Se normalizan (sin espacios, sin barra final, en minúsculas) porque un
  // origen se compara literalmente: "https://x.app/" y "https://x.app" son
  // distintos para la comparación y el fallo resultante es silencioso.
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean),
} as const;

if (env.isProd && raw.PIXELPAY_MODE === 'production' && !raw.PIXELPAY_API_KEY) {
  console.error('PIXELPAY_MODE=production requiere PIXELPAY_API_KEY y PIXELPAY_API_SECRET.');
  process.exit(1);
}
