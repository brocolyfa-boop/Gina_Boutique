import { crearApp } from './app.js';
import { env } from './env.js';
import { prisma } from './prisma.js';

const app = crearApp();

const server = app.listen(env.PORT, () => {
  console.log(`Gina Boutique API escuchando en :${env.PORT} (${env.NODE_ENV})`);
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
