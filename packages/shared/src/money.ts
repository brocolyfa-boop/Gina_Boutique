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
  ahora: Date = new Date(),
): number {
  return ofertaVigente(precio, precioOferta, vigencia, ahora)
    ? redondear(precioOferta as number)
    : redondear(precio);
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

/* --------------------------- resumen para WhatsApp ------------------------- */

interface LineaPedido {
  nombre: string;
  cantidad: number;
  talla?: string | null;
  color?: string | null;
  precioUnitario: number;
}

interface PedidoResumible {
  numero: string;
  nombreCliente: string;
  telefonoContacto: string;
  departamento: string;
  municipio: string;
  direccionEnvio: string;
  referencia?: string | null;
  items: LineaPedido[];
  subtotal: number;
  costoEnvio: number;
  total: number;
  notas?: string | null;
}

/**
 * Texto del pedido para WhatsApp.
 *
 * Vive en el paquete compartido porque lo usan dos lados: el aviso automático
 * que manda el servidor y el botón "Enviar por WhatsApp" del cliente. Si cada
 * uno armara su propio texto, terminarían diciendo cosas distintas del mismo
 * pedido.
 */
export function resumenPedidoWhatsApp(o: PedidoResumible): string {
  const lineas = o.items.map((i) => {
    const variante = [i.talla, i.color].filter(Boolean).join(' / ');
    return `• ${i.cantidad}x ${i.nombre}${variante ? ` (${variante})` : ''} — ${formatLps(
      i.precioUnitario * i.cantidad,
    )}`;
  });

  return [
    `*Pedido ${o.numero}*`,
    '',
    `*Cliente:* ${o.nombreCliente}`,
    `*Teléfono:* ${o.telefonoContacto}`,
    `*Entrega:* ${o.direccionEnvio}, ${o.municipio}, ${o.departamento}`,
    ...(o.referencia ? [`*Referencia:* ${o.referencia}`] : []),
    '',
    ...lineas,
    '',
    `Subtotal: ${formatLps(o.subtotal)}`,
    `Envío: ${formatLps(o.costoEnvio)}`,
    `*Total: ${formatLps(o.total)}*`,
    ...(o.notas ? ['', `*Notas:* ${o.notas}`] : []),
  ].join('\n');
}

/** Estados con un mensaje que tiene sentido mandarle al cliente. */
const MENSAJE_ESTADO: Record<string, (o: PedidoResumible) => string> = {
  pendiente: (o) => `Recibimos tu pedido ${o.numero}. Ya lo estamos preparando.`,
  pagado: (o) => `Confirmamos el pago de tu pedido ${o.numero}. Lo preparamos hoy mismo.`,
  enviado: (o) =>
    `Tu pedido ${o.numero} ya va en camino a ${o.municipio}. Llega en 1 a 2 días; te avisamos antes de tocar la puerta.`,
  entregado: (o) => `Entregamos tu pedido ${o.numero}. ¡Gracias por comprar con nosotros!`,
  cancelado: (o) => `Tu pedido ${o.numero} quedó cancelado. Si fue un error, escríbenos y lo reactivamos.`,
};

/**
 * Mensaje para el cliente según el estado de su pedido.
 *
 * Lo usa el botón del panel que abre WhatsApp con el texto ya escrito. No se
 * manda solo a propósito: mientras no haya credenciales de Meta, un botón que
 * abre la conversación es la forma más barata de que el cliente se entere.
 */
export function mensajeEstadoWhatsApp(o: PedidoResumible, estado: string): string {
  const base = MENSAJE_ESTADO[estado]?.(o) ?? `Novedades de tu pedido ${o.numero}.`;
  return `Hola ${o.nombreCliente.split(' ')[0]}, ${base[0]?.toLowerCase()}${base.slice(1)}`;
}

/* -------------------------------- promociones ------------------------------ */

export interface PromocionAplicable {
  tipo: 'porcentaje' | 'monto_fijo';
  valor: number;
  /** Vacío = no está limitada a productos concretos. */
  productoIds: string[];
  /** null = no está limitada a una categoría. */
  categoriaId: string | null;
  fechaInicio: string | Date;
  fechaFin: string | Date;
  activo: boolean;
}

interface ProductoPromocionable {
  id: string;
  categoriaId: string;
  precio: number;
  precioOferta?: number | null;
  ofertaInicio?: string | Date | null;
  ofertaFin?: string | Date | null;
}

function vigente(p: PromocionAplicable, ahora: Date): boolean {
  if (!p.activo) return false;
  return new Date(p.fechaInicio) <= ahora && ahora <= new Date(p.fechaFin);
}

function alcanza(p: PromocionAplicable, producto: ProductoPromocionable): boolean {
  if (p.productoIds.length > 0) return p.productoIds.includes(producto.id);
  if (p.categoriaId) return p.categoriaId === producto.categoriaId;
  // Sin productos ni categoría, la promoción es de toda la tienda.
  return true;
}

/**
 * Precio final considerando la oferta del producto y las promociones vigentes.
 *
 * Las promociones NO se acumulan: se toma la que más le convenga al cliente.
 * Acumularlas es como las tiendas terminan regalando mercadería sin darse
 * cuenta — dos promos del 50% dejarían la prenda en el 25% de su precio.
 *
 * Tampoco baja de cero, y siempre parte del precio de oferta del producto si lo
 * tiene: una promoción de categoría no debería subir el precio de algo que ya
 * estaba rebajado.
 */
export function precioConPromociones(
  producto: ProductoPromocionable,
  promociones: PromocionAplicable[],
  ahora: Date = new Date(),
): number {
  // `ahora` se pasa también aquí: si no, las promociones se evaluarían en la
  // fecha indicada y la oferta del producto en la hora real del servidor, y con
  // una fecha de prueba las dos mitades del cálculo dirían cosas distintas.
  const base = precioFinal(
    producto.precio,
    producto.precioOferta ?? null,
    { inicio: producto.ofertaInicio ?? null, fin: producto.ofertaFin ?? null },
    ahora,
  );

  let mejor = base;
  for (const promo of promociones) {
    if (!vigente(promo, ahora) || !alcanza(promo, producto)) continue;
    const candidato =
      promo.tipo === 'porcentaje'
        ? base * (1 - Math.min(promo.valor, 100) / 100)
        : base - promo.valor;
    mejor = Math.min(mejor, Math.max(0, candidato));
  }

  return redondear(mejor);
}

/** Porcentaje total de rebaja contra el precio de lista, o null si no hay. */
export function descuentoTotalPorcentaje(
  producto: ProductoPromocionable,
  promociones: PromocionAplicable[],
  ahora: Date = new Date(),
): number | null {
  const final = precioConPromociones(producto, promociones, ahora);
  if (producto.precio <= 0 || final >= producto.precio) return null;
  return Math.round(((producto.precio - final) / producto.precio) * 100);
}
