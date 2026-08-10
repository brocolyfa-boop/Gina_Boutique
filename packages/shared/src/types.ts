import type { EstadoOrden, MetodoPago, Rol, TipoPromocion } from './constants.js';

/** Forma en que la API devuelve los recursos a web y mobile. */

export interface UserDTO {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  direccion: string | null;
  rol: Rol;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
  refreshToken: string;
}

export interface CategoriaDTO {
  id: string;
  nombre: string;
  slug: string;
  imagen: string | null;
  orden: number;
  subcategorias: string[];
  totalProductos?: number;
}

export interface ProductoDTO {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioOferta: number | null;
  /** Precio que realmente paga el cliente (oferta si existe, si no el base). */
  precioFinal: number;
  descuentoPorcentaje: number | null;
  categoria: Pick<CategoriaDTO, 'id' | 'nombre' | 'slug'>;
  subcategoria: string | null;
  tallas: string[];
  colores: string[];
  stock: number;
  imagenes: string[];
  destacado: boolean;
  activo: boolean;
  createdAt: string;
}

export interface PromocionDTO {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: TipoPromocion;
  valor: number;
  productoIds: string[];
  categoriaId: string | null;
  fechaInicio: string;
  fechaFin: string;
  bannerImagen: string | null;
  activo: boolean;
}

export interface CartItemDTO {
  productoId: string;
  cantidad: number;
  talla: string | null;
  color: string | null;
  /** Datos del producto resueltos por la API para no hacer N peticiones. */
  producto: Pick<
    ProductoDTO,
    'nombre' | 'precio' | 'precioOferta' | 'precioFinal' | 'imagenes' | 'stock'
  > | null;
  totalLinea: number;
}

export interface CartDTO {
  items: CartItemDTO[];
  subtotal: number;
  costoEnvio: number;
  total: number;
}

export interface OrdenItemDTO {
  productoId: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  talla: string | null;
  color: string | null;
  imagen: string | null;
}

export interface OrdenDTO {
  id: string;
  numero: string;
  items: OrdenItemDTO[];
  subtotal: number;
  costoEnvio: number;
  total: number;
  estado: EstadoOrden;
  metodoPago: MetodoPago;
  direccionEnvio: string;
  departamento: string;
  municipio: string;
  referencia: string | null;
  telefonoContacto: string;
  entregaEstimadaDias: { min: number; max: number };
  pixelpayTransactionId: string | null;
  createdAt: string;
}

export interface ConfigPublicaDTO {
  costoEnvioLps: number;
  moneda: string;
  pixelpayMode: 'sandbox' | 'production';
  metodosPago: MetodoPago[];
}

export interface Paginado<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface ApiError {
  error: { message: string; code: string; detalles?: Record<string, string[]> };
}
