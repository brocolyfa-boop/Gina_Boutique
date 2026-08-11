import type { Prisma, Product } from '@prisma/client';
import type { CartDTO, CartItemDTO, CartItemInput } from '@gina/shared';
import { precioFinal, redondear } from '@gina/shared';
import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { notFound, unprocessable } from './errors.js';
import { num, numOrNull } from './dto.js';

/** Normaliza los opcionales: '' y undefined se guardan siempre como null. */
export const normalizar = (v?: string | null): string | null => {
  const limpio = v?.trim();
  return limpio ? limpio : null;
};

export async function obtenerOCrearCarrito(userId: string): Promise<string> {
  const existente = await prisma.cart.findUnique({ where: { userId }, select: { id: true } });
  if (existente) return existente.id;
  const creado = await prisma.cart.create({ data: { userId }, select: { id: true } });
  return creado.id;
}

/**
 * Valida una línea contra el producto real: que exista, esté activo, tenga stock
 * y que la talla y el color pedidos sean de los que ese producto ofrece. Sin
 * esto, un cliente podría pedir una talla que no existe editando la petición.
 */
export function validarLinea(producto: Product, item: CartItemInput): void {
  if (!producto.activo) throw unprocessable(`"${producto.nombre}" ya no está disponible`);

  if (producto.stock < item.cantidad) {
    throw unprocessable(
      producto.stock === 0
        ? `"${producto.nombre}" está agotado`
        : `Solo quedan ${producto.stock} unidades de "${producto.nombre}"`,
    );
  }

  const talla = normalizar(item.talla);
  if (producto.tallas.length > 0 && !talla) {
    throw unprocessable(`Elige una talla para "${producto.nombre}"`);
  }
  if (talla && !producto.tallas.includes(talla)) {
    throw unprocessable(`La talla ${talla} no está disponible en "${producto.nombre}"`);
  }

  const color = normalizar(item.color);
  if (producto.colores.length > 0 && !color) {
    throw unprocessable(`Elige un color para "${producto.nombre}"`);
  }
  if (color && !producto.colores.includes(color)) {
    throw unprocessable(`El color ${color} no está disponible en "${producto.nombre}"`);
  }
}

export async function productoOFalla(productoId: string): Promise<Product> {
  const producto = await prisma.product.findUnique({ where: { id: productoId } });
  if (!producto) throw notFound('Producto no encontrado');
  return producto;
}

type LineaConProducto = {
  id?: string;
  cantidad: number;
  talla: string | null;
  color: string | null;
  producto: Product;
};

/**
 * Arma el carrito que ven los clientes. Los precios y el costo de envío se
 * toman SIEMPRE de la base y del entorno, nunca de lo que manda el cliente.
 */
export function armarCartDTO(lineas: LineaConProducto[]): CartDTO {
  const items: CartItemDTO[] = lineas.map((l) => {
    const precio = num(l.producto.precio);
    const final = precioFinal(precio, numOrNull(l.producto.precioOferta), {
      inicio: l.producto.ofertaInicio,
      fin: l.producto.ofertaFin,
    });
    return {
      id: l.id ?? null,
      productoId: l.producto.id,
      cantidad: l.cantidad,
      talla: l.talla,
      color: l.color,
      producto: {
        nombre: l.producto.nombre,
        precio,
        precioOferta: numOrNull(l.producto.precioOferta),
        precioFinal: final,
        imagenes: l.producto.imagenes,
        stock: l.producto.stock,
      },
      totalLinea: redondear(final * l.cantidad),
    };
  });

  const subtotal = redondear(items.reduce((acc, i) => acc + i.totalLinea, 0));
  // El envío depende de la zona y aquí todavía no se conoce la dirección, así
  // que se muestra la tarifa más barata como estimación. El definitivo lo fija
  // la API al crear la orden, con el departamento y municipio reales.
  const tarifaMinima = Math.min(env.tarifasEnvio.tegucigalpa, env.tarifasEnvio.nacional);
  const costoEnvio = items.length > 0 ? tarifaMinima : 0;

  return {
    items,
    subtotal,
    costoEnvio,
    envioEstimado: items.length > 0,
    total: redondear(subtotal + costoEnvio),
  };
}

export async function leerCarrito(userId: string): Promise<CartDTO> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { producto: true }, orderBy: { id: 'asc' } } },
  });
  if (!cart) return armarCartDTO([]);
  return armarCartDTO(cart.items);
}

/**
 * Busca una línea equivalente. No se usa `findUnique` sobre la restricción
 * compuesta porque Postgres trata dos NULL como distintos, y los accesorios van
 * sin talla ni color: por esa vía se duplicarían.
 */
export function lineaEquivalente(
  tx: Prisma.TransactionClient,
  cartId: string,
  productoId: string,
  talla: string | null,
  color: string | null,
) {
  return tx.cartItem.findFirst({ where: { cartId, productoId, talla, color } });
}
