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

export function precioFinal(precio: number, precioOferta?: number | null): number {
  return precioOferta != null && precioOferta > 0 && precioOferta < precio
    ? redondear(precioOferta)
    : redondear(precio);
}

export function descuentoPorcentaje(precio: number, precioOferta?: number | null): number | null {
  if (precioOferta == null || precioOferta <= 0 || precioOferta >= precio) return null;
  return Math.round(((precio - precioOferta) / precio) * 100);
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
