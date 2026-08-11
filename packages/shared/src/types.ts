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

/** Medidas de la prenda, en centímetros. Todas opcionales. */
export interface MedidasPrenda {
  pecho?: number;
  cintura?: number;
  cadera?: number;
  largo?: number;
  manga?: number;
  tiro?: number;
}

/** Datos para cotizar el envío de un producto. */
export interface EnvioProducto {
  pesoGramos: number | null;
  altoCm: number | null;
  anchoCm: number | null;
  largoCm: number | null;
}

export interface ProductoDTO {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioOferta: number | null;
  /** Ventana de la oferta. Null en ambos = la oferta no caduca. */
  ofertaInicio: string | null;
  ofertaFin: string | null;
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
  sku: string | null;
  marca: string | null;
  material: string | null;
  tipoPrenda: string | null;
  medidas: MedidasPrenda | null;
  envio: EnvioProducto;
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
  /**
   * Id de la línea en la base. Es null en el carrito de invitado, que vive en
   * localStorage/AsyncStorage y no tiene filas. Los clientes lo usan para editar
   * o quitar la línea sin depender de su posición en la lista.
   */
  id: string | null;
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
  /**
   * Envío estimado con la tarifa más barata: en el carrito todavía no se conoce
   * la dirección. El definitivo se calcula en el checkout y lo confirma la API
   * al crear la orden.
   */
  costoEnvio: number;
  /** true mientras el envío sea una estimación y no el cobro final. */
  envioEstimado: boolean;
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
  /** Copiado en la orden; en una compra de invitado no hay cuenta que consultar. */
  nombreCliente: string;
  emailCliente: string | null;
  /** true cuando se compró sin cuenta. */
  esInvitado: boolean;
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
  /** Instrucciones del cliente. Van en el aviso: son para quien entrega. */
  notas: string | null;
  entregaEstimadaDias: { min: number; max: number };
  pixelpayTransactionId: string | null;
  createdAt: string;
}

export interface ConfigPublicaDTO {
  /** Número de WhatsApp de la tienda, o cadena vacía si no está configurado. */
  whatsapp: string;
  /** Tarifa más barata. Sirve para el "desde L X" antes de conocer la dirección. */
  costoEnvioLps: number;
  tarifasEnvio: { tegucigalpa: number; nacional: number };
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

/* -------------------------- panel de administración ------------------------ */

export interface ResumenVentas {
  ventas: number;
  pedidos: number;
  ticketPromedio: number;
  unidades: number;
}

export interface VentaPorZona {
  departamento: string;
  municipio?: string;
  pedidos: number;
  ventas: number;
  /** Porcentaje sobre el total del periodo, para pintar las barras. */
  porcentaje: number;
}

export interface PuntoSerie {
  /** Día en formato YYYY-MM-DD, en hora de Honduras. */
  fecha: string;
  ventas: number;
  pedidos: number;
}

export interface ProductoVendido {
  productoId: string;
  nombre: string;
  unidades: number;
  ventas: number;
}

export interface ProductoStockBajo {
  id: string;
  nombre: string;
  stock: number;
  categoria: string;
}

export interface VentaPorCategoria {
  categoriaId: string;
  nombre: string;
  unidades: number;
  ventas: number;
  porcentaje: number;
}

export interface ClienteTop {
  id: string;
  nombre: string;
  email: string;
  pedidos: number;
  ventas: number;
}

/** Fotografía del catálogo, sin filtro de fecha: es el estado de hoy. */
export interface ResumenCatalogo {
  productos: number;
  productosActivos: number;
  categorias: number;
  clientes: number;
  unidadesEnStock: number;
  valorInventario: number;
  sinStock: number;
}

export interface DashboardDTO {
  rango: { desde: string; hasta: string; etiqueta: string };
  resumen: ResumenVentas;
  /** El mismo resumen del periodo anterior de igual duración, para comparar. */
  resumenPrevio: ResumenVentas;
  porDepartamento: VentaPorZona[];
  porMunicipio: VentaPorZona[];
  serie: PuntoSerie[];
  masVendidos: ProductoVendido[];
  stockBajo: ProductoStockBajo[];
  pedidosPorEstado: Array<{ estado: string; pedidos: number }>;
  porCategoria: VentaPorCategoria[];
  topClientes: ClienteTop[];
  catalogo: ResumenCatalogo;
}

export const PERIODOS_DASHBOARD = ['hoy', '7d', '30d', '90d'] as const;
export type PeriodoDashboard = (typeof PERIODOS_DASHBOARD)[number];
