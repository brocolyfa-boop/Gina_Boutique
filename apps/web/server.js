/**
 * Servidor estático para producción (Railway).
 *
 * Vite genera una SPA: el enrutado ocurre en el navegador y en el disco solo
 * existe index.html. Sin este servidor, entrar directo a /catalogo o recargar
 * en /producto/abc devolvería 404, porque no hay ningún archivo con ese nombre.
 * Aquí cualquier ruta que no corresponda a un archivo real cae en index.html y
 * React Router se encarga del resto.
 */
import express from 'express';
import compression from 'compression';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const puerto = process.env.PORT || 4173;

const app = express();
app.use(compression());

// Los assets llevan hash en el nombre, así que se pueden cachear para siempre.
app.use(
  express.static(dist, {
    index: false,
    setHeaders(res, ruta) {
      if (ruta.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

// index.html NUNCA se cachea: es lo que apunta a la versión nueva de los assets.
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(puerto, () => {
  console.log(`Gina Boutique web sirviendo en :${puerto}`);
});
