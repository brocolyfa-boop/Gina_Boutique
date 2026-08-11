import type { Category, Order, Product, Promotion, User } from '@prisma/client';
import type {
  CategoriaDTO,
  MedidasPrenda,
  OrdenDTO,
  OrdenItemDTO,
  ProductoDTO,
  PromocionDTO,
  UserDTO,
} from '@gina/shared';
import {
  descuentoTotalPorcentaje,
  entregaEstimada,
  precioConPromociones,
  type PromocionAplicable,
} from '@gina/shared';
import type { Prisma } from '@prisma/client';

/** Prisma devuelve Decimal; los clientes esperan number. */
export const num = (d: Prisma.Decimal | number | null): number =>
  d == null ? 0 : typeof d === 'number' ? d : d.toNumber();

export const numOrNull = (d: Prisma.Decimal | number | null): number | null =>
  d == null ? null : num(d);

export function toUserDTO(u: User): UserDTO {
  return {
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    telefono: u.telefono,
    direccion: u.direccion,
    rol: u.rol,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toCategoriaDTO(c: Category, totalProductos?: number): CategoriaDTO {
  return {
    id: c.id,
    nombre: c.nombre,
    slug: c.slug,
    imagen: c.imagen,
    orden: c.orden,
    subcategorias: c.subcategorias,
    ...(totalProductos != null ? { totalProductos } : {}),
  };
}

/**
 * `promociones` es obligatorio a propósito: el precio mostrado tiene que ser el
 * mismo que se cobra, y un parámetro opcional invita a olvidarlo en una ruta
 * nueva y a anunciar un descuento que la caja no aplica.
 */
export function toProductoDTO(
  p: Product & { categoria: Category },
  promociones: PromocionAplicable[],
): ProductoDTO {
  const precio = num(p.precio);
  const oferta = numOrNull(p.precioOferta);
  const promocionable = {
    id: p.id,
    categoriaId: p.categoriaId,
    precio,
    precioOferta: oferta,
    ofertaInicio: p.ofertaInicio,
    ofertaFin: p.ofertaFin,
  };
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio,
    precioOferta: oferta,
    ofertaInicio: p.ofertaInicio?.toISOString() ?? null,
    ofertaFin: p.ofertaFin?.toISOString() ?? null,
    precioFinal: precioConPromociones(promocionable, promociones),
    descuentoPorcentaje: descuentoTotalPorcentaje(promocionable, promociones),
    categoria: { id: p.categoria.id, nombre: p.categoria.nombre, slug: p.categoria.slug },
    subcategoria: p.subcategoria,
    tallas: p.tallas,
    colores: p.colores,
    stock: p.stock,
    imagenes: p.imagenes,
    destacado: p.destacado,
    activo: p.activo,
    sku: p.sku,
    marca: p.marca,
    material: p.material,
    tipoPrenda: p.tipoPrenda,
    medidas: (p.medidas as MedidasPrenda | null) ?? null,
    envio: {
      pesoGramos: p.pesoGramos,
      altoCm: numOrNull(p.altoCm),
      anchoCm: numOrNull(p.anchoCm),
      largoCm: numOrNull(p.largoCm),
    },
    createdAt: p.createdAt.toISOString(),
  };
}

/** GB-000123. El correlativo lo asigna la secuencia de Postgres. */
export const numeroDeOrden = (secuencia: number): string =>
  `GB-${String(secuencia).padStart(6, '0')}`;

export function toOrdenDTO(o: Order): OrdenDTO {
  // `items` es Json en la base: se guardó ya con la forma de OrdenItemDTO.
  const items = o.items as unknown as OrdenItemDTO[];
  const { diasMin, diasMax } = entregaEstimada(o.departamento);
  return {
    id: o.id,
    numero: numeroDeOrden(o.secuencia),
    nombreCliente: o.nombreCliente,
    emailCliente: o.emailCliente,
    esInvitado: o.userId === null,
    items,
    subtotal: num(o.subtotal),
    costoEnvio: num(o.costoEnvio),
    total: num(o.total),
    estado: o.estado,
    metodoPago: o.metodoPago,
    direccionEnvio: o.direccionEnvio,
    departamento: o.departamento,
    municipio: o.municipio,
    referencia: o.referencia,
    telefonoContacto: o.telefonoContacto,
    notas: o.notas,
    entregaEstimadaDias: { min: diasMin, max: diasMax },
    pixelpayTransactionId: o.pixelpayTransactionId,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toPromocionDTO(p: Promotion): PromocionDTO {
  return {
    id: p.id,
    titulo: p.titulo,
    descripcion: p.descripcion,
    tipo: p.tipo,
    valor: num(p.valor),
    productoIds: p.productoIds,
    categoriaId: p.categoriaId,
    fechaInicio: p.fechaInicio.toISOString(),
    fechaFin: p.fechaFin.toISOString(),
    bannerImagen: p.bannerImagen,
    activo: p.activo,
  };
}
