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
        cb(null, !origin || env.corsOrigins.includes(origin));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  if (!env.isProd) app.use(morgan('dev'));

  app.get('/health', (_req, res) => res.json({ ok: true, servicio: 'gina-boutique-api' }));

  app.use('/api/auth', authRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/categorias', categoryRoutes);
  app.use('/api/productos', productRoutes);
  app.use('/api/promociones', promotionRoutes);
  app.use('/api/carrito', cartRoutes);
  app.use('/api/ordenes', orderRoutes);
  app.use('/api/direcciones', addressRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
