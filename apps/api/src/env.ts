import { z } from 'zod';

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
  COSTO_ENVIO_LPS: z.coerce.number().nonnegative().default(65),
  // Se incluyen las variantes con 127.0.0.1: el navegador manda cabecera
  // Origin en los POST aunque sean del mismo origen, y localhost y 127.0.0.1
  // son orígenes distintos para esa comprobación.
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8081,http://127.0.0.1:8081',
    ),
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
  corsOrigins: raw.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
} as const;

if (env.isProd && raw.PIXELPAY_MODE === 'production' && !raw.PIXELPAY_API_KEY) {
  console.error('PIXELPAY_MODE=production requiere PIXELPAY_API_KEY y PIXELPAY_API_SECRET.');
  process.exit(1);
}
