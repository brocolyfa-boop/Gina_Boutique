import type { Category, Product, Promotion, User } from '@prisma/client';
import type { CategoriaDTO, ProductoDTO, PromocionDTO, UserDTO } from '@gina/shared';
import { descuentoPorcentaje, precioFinal } from '@gina/shared';
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

export function toProductoDTO(p: Product & { categoria: Category }): ProductoDTO {
  const precio = num(p.precio);
  const oferta = numOrNull(p.precioOferta);
  return {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio,
    precioOferta: oferta,
    precioFinal: precioFinal(precio, oferta),
    descuentoPorcentaje: descuentoPorcentaje(precio, oferta),
    categoria: { id: p.categoria.id, nombre: p.categoria.nombre, slug: p.categoria.slug },
    subcategoria: p.subcategoria,
    tallas: p.tallas,
    colores: p.colores,
    stock: p.stock,
    imagenes: p.imagenes,
    destacado: p.destacado,
    activo: p.activo,
    createdAt: p.createdAt.toISOString(),
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
