import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { env } from './env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import addressRoutes from './routes/addresses.js';
import authRoutes from './routes/auth.js';
import cartRoutes from './routes/cart.js';
import categoryRoutes from './routes/categories.js';
import configRoutes from './routes/config.js';
import orderRoutes from './routes/orders.js';
import productRoutes from './routes/products.js';
import promotionRoutes from './routes/promotions.js';
import uploadRoutes from './routes/uploads.js';
import userRoutes from './routes/users.js';

/**
 * Primer origen permitido por CORS que parezca la web. Sirve de respaldo para
 * no tener que configurar una variable más solo para la redirección.
 */
function primerOrigenWeb(): string {
  return env.corsOrigins.find((o) => o.startsWith('https://')) ?? '';
}

export function crearApp() {
  const app = express();

  // Railway corre detrás de proxy: necesario para que rate-limit vea la IP real.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin(origin, cb) {
        // Sin Origin = app nativa (React Native) o curl: se permite.
        // Un origen no permitido se rechaza devolviendo `false`, no lanzando:
        // lanzar convertía un problema de configuración en un 500 con el
        // mensaje interno dentro, y el navegador ya bloquea la respuesta al no
        // ver la cabecera. Así el fallo se diagnostica en vez de confundir.
        const normalizado = origin?.trim().replace(/\/+$/, '').toLowerCase();
        cb(null, !normalizado || env.corsOrigins.includes(normalizado));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true, servicio: 'gina-boutique-api' }));

  /*
    La raíz de la API.

    Este servicio y el de la web tienen direcciones parecidas en Railway, así que
    tarde o temprano alguien escribe la de la API en el navegador buscando la
    tienda. Antes se topaba con un JSON de error crudo, que parece que todo está
    roto. Ahora se le manda a la tienda, y si no hay dirección configurada al
    menos se le explica dónde está parado.
  */
  app.get('/', (_req, res) => {
    const tienda = env.URL_TIENDA.trim() || primerOrigenWeb();
    if (tienda) return res.redirect(302, tienda);
    res.type('text/plain').send(
      'Este es el servidor de Gina Boutique, no la tienda.\n' +
        'La tienda está en otra dirección; pregúntale a quien administra el sitio.\n',
    );
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/categorias', categoryRoutes);
  app.use('/api/productos', productRoutes);
  app.use('/api/promociones', promotionRoutes);
  app.use('/api/carrito', cartRoutes);
  app.use('/api/ordenes', orderRoutes);
  app.use('/api/direcciones', addressRoutes);
  app.use('/api/imagenes', uploadRoutes);
  app.use('/api/usuarios', userRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
