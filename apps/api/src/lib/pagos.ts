import type { MetodoPago } from '@gina/shared';
import { env } from '../env.js';
import { unprocessable } from './errors.js';

/**
 * Contrato de cobro. Deliberadamente no hay ninguna pasarela cableada: cuando se
 * decida cómo cobrar con tarjeta (PixelPay, Clinpays, un link de pago, u otra
 * cosa), se implementa esta interfaz y se registra abajo. Nada del carrito, las
 * órdenes ni el checkout necesita cambiar.
 */
export interface ResultadoCobro {
  /** true si el dinero ya está confirmado; false si queda pendiente de cobro. */
  cobrado: boolean;
  /** Referencia del proveedor, para conciliar después. Null en contra entrega. */
  transaccionId: string | null;
}

export interface ProveedorPago {
  readonly metodo: MetodoPago;
  /** Etiqueta que la web y la app muestran en el selector de pago. */
  readonly etiqueta: string;
  readonly descripcion: string;
  /** false cuando falta configuración; el método no se ofrece al cliente. */
  disponible(): boolean;
  cobrar(args: { montoLps: number; token?: string; ordenRef: string }): Promise<ResultadoCobro>;
}

/** Pago en efectivo al recibir. No mueve dinero: la orden nace pendiente. */
const contraEntrega: ProveedorPago = {
  metodo: 'contra_entrega',
  etiqueta: 'Pago contra entrega',
  descripcion: 'Pagas en efectivo cuando recibas tu pedido.',
  disponible: () => true,
  cobrar: async () => ({ cobrado: false, transaccionId: null }),
};

/**
 * Hueco para el cobro con tarjeta. Se reporta como no disponible mientras no
 * haya proveedor, así el checkout simplemente no ofrece la opción en vez de
 * aceptar una orden que nunca se va a poder cobrar.
 *
 * Al implementarlo: el cliente tokeniza la tarjeta con el SDK del proveedor y
 * aquí solo llega `token`. Nunca recibir ni guardar número de tarjeta ni CVV.
 */
const tarjeta: ProveedorPago = {
  metodo: 'tarjeta',
  etiqueta: 'Tarjeta de crédito o débito',
  descripcion: 'Pago seguro con VISA o Mastercard.',
  disponible: () => Boolean(env.PIXELPAY_API_KEY && env.PIXELPAY_API_SECRET),
  cobrar: async () => {
    throw unprocessable(
      'El pago con tarjeta todavía no está habilitado. Elige pago contra entrega.',
    );
  },
};

const PROVEEDORES: ProveedorPago[] = [contraEntrega, tarjeta];

export function metodosDisponibles(): ProveedorPago[] {
  return PROVEEDORES.filter((p) => p.disponible());
}

export function proveedorDe(metodo: MetodoPago): ProveedorPago {
  const proveedor = metodosDisponibles().find((p) => p.metodo === metodo);
  if (!proveedor) {
    throw unprocessable(`El método de pago "${metodo}" no está disponible en este momento`);
  }
  return proveedor;
}
