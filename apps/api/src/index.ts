import { crearApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = crearApp();

const server = app.listen(env.PORT, () => {
  console.log(`Gina Boutique API escuchando en :${env.PORT} (${env.NODE_ENV})`);
  // Se imprimen los orígenes permitidos porque un CORS mal configurado falla de
  // forma silenciosa y confusa: el catálogo carga (son GET sin cabecera Origin)
  // pero registrarse o comprar se bloquea en el navegador. Con esto se ve en el
  // log qué tiene cargado el proceso, en vez de deducirlo desde afuera.
  console.log(`CORS permite: ${env.corsOrigins.join(' | ') || '(ninguno)'}`);
});

async function apagar(senal: string) {
  console.log(`${senal} recibido, cerrando…`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void apagar('SIGTERM'));
process.on('SIGINT', () => void apagar('SIGINT'));
