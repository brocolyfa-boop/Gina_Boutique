import type { PromocionAplicable } from '@gina/shared';
import { prisma } from '../prisma.js';

/**
 * Promociones vigentes, con caché corta en memoria.
 *
 * El precio de cada producto depende de esta lista, así que se consulta en el
 * catálogo, en el carrito y al crear la orden — varias veces por pantalla. Sin
 * caché serían decenas de consultas idénticas por segundo para leer una tabla
 * que cambia dos veces al mes.
 *
 * Treinta segundos es el compromiso: una promoción recién creada tarda a lo
 * sumo medio minuto en verse, y eso es aceptable; media hora no lo sería.
 */
const TTL_MS = 30_000;

let cache: { valor: PromocionAplicable[]; expira: number } | null = null;

export function invalidarPromociones(): void {
  cache = null;
}

export async function promocionesVigentes(): Promise<PromocionAplicable[]> {
  const ahora = Date.now();
  if (cache && cache.expira > ahora) return cache.valor;

  const filas = await prisma.promotion.findMany({
    where: {
      activo: true,
      fechaInicio: { lte: new Date(ahora) },
      fechaFin: { gte: new Date(ahora) },
    },
    select: {
      tipo: true,
      valor: true,
      productoIds: true,
      categoriaId: true,
      fechaInicio: true,
      fechaFin: true,
      activo: true,
    },
  });

  const valor: PromocionAplicable[] = filas.map((p) => ({
    tipo: p.tipo,
    valor: Number(p.valor),
    productoIds: p.productoIds,
    categoriaId: p.categoriaId,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    activo: p.activo,
  }));

  cache = { valor, expira: ahora + TTL_MS };
  return valor;
}
