import { MONEDA_SIMBOLO } from './constants.js';

/** Redondea a 2 decimales evitando el arrastre binario de los flotantes. */
export function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/** Formato de lempiras: L 1,250.00 */
export function formatLps(valor: number): string {
  return `${MONEDA_SIMBOLO} ${redondear(valor).toLocaleString('es-HN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Ventana de vigencia de una oferta. Ambos extremos son opcionales. */
export interface VigenciaOferta {
  inicio?: string | Date | null;
  fin?: string | Date | null;
}

/**
 * Una oferta cuenta solo si el precio rebajado tiene sentido Y estamos dentro de
 * su ventana. Sin fechas, aplica siempre. Es la misma regla en la web, en la app
 * y en el servidor: si divergieran, el cliente vería un precio y pagaría otro.
 */
export function ofertaVigente(
  precio: number,
  precioOferta?: number | null,
  vigencia?: VigenciaOferta,
  ahora: Date = new Date(),
): boolean {
  if (precioOferta == null || precioOferta <= 0 || precioOferta >= precio) return false;

  const inicio = vigencia?.inicio ? new Date(vigencia.inicio) : null;
  if (inicio && ahora < inicio) return false;

  const fin = vigencia?.fin ? new Date(vigencia.fin) : null;
  if (fin && ahora > fin) return false;

  return true;
}

export function precioFinal(
  precio: number,
  precioOferta?: number | null,
  vigencia?: VigenciaOferta,
): number {
  return ofertaVigente(precio, precioOferta, vigencia)
    ? redondear(precioOferta as number)
    : redondear(precio);
}

export function descuentoPorcentaje(
  precio: number,
  precioOferta?: number | null,
  vigencia?: VigenciaOferta,
): number | null {
  if (!ofertaVigente(precio, precioOferta, vigencia)) return null;
  return Math.round(((precio - (precioOferta as number)) / precio) * 100);
}

/** Total de la orden: subtotal + envío fijo. El envío llega del backend. */
export function calcularTotales(
  items: Array<{ precioUnitario: number; cantidad: number }>,
  costoEnvio: number,
): { subtotal: number; costoEnvio: number; total: number } {
  const subtotal = redondear(
    items.reduce((acc, i) => acc + i.precioUnitario * i.cantidad, 0),
  );
  return { subtotal, costoEnvio: redondear(costoEnvio), total: redondear(subtotal + costoEnvio) };
}
