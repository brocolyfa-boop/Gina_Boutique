/**
 * Constantes compartidas entre api, web y mobile.
 *
 * Regla importante: el costo de envío NO vive aquí como número final. El backend
 * lo expone en `GET /api/config` leyéndolo de `COSTO_ENVIO_LPS`, para poder
 * cambiarlo sin republicar la app Android. Lo que sigue es solo el valor de
 * respaldo por si el cliente aún no ha podido leer la config.
 */
export const COSTO_ENVIO_FALLBACK_LPS = 65;

export const MONEDA = 'HNL' as const;
export const MONEDA_SIMBOLO = 'L' as const;

/** Los 18 departamentos de Honduras, con el rango estimado de entrega en días. */
export const DEPARTAMENTOS_HONDURAS = [
  { nombre: 'Atlántida', diasMin: 2, diasMax: 4 },
  { nombre: 'Choluteca', diasMin: 2, diasMax: 5 },
  { nombre: 'Colón', diasMin: 3, diasMax: 6 },
  { nombre: 'Comayagua', diasMin: 1, diasMax: 3 },
  { nombre: 'Copán', diasMin: 3, diasMax: 5 },
  { nombre: 'Cortés', diasMin: 1, diasMax: 3 },
  { nombre: 'El Paraíso', diasMin: 2, diasMax: 4 },
  { nombre: 'Francisco Morazán', diasMin: 1, diasMax: 2 },
  { nombre: 'Gracias a Dios', diasMin: 5, diasMax: 10 },
  { nombre: 'Intibucá', diasMin: 3, diasMax: 5 },
  { nombre: 'Islas de la Bahía', diasMin: 4, diasMax: 7 },
  { nombre: 'La Paz', diasMin: 2, diasMax: 4 },
  { nombre: 'Lempira', diasMin: 3, diasMax: 6 },
  { nombre: 'Ocotepeque', diasMin: 3, diasMax: 6 },
  { nombre: 'Olancho', diasMin: 3, diasMax: 5 },
  { nombre: 'Santa Bárbara', diasMin: 2, diasMax: 4 },
  { nombre: 'Valle', diasMin: 2, diasMax: 5 },
  { nombre: 'Yoro', diasMin: 2, diasMax: 4 },
] as const;

export const DEPARTAMENTOS = DEPARTAMENTOS_HONDURAS.map((d) => d.nombre);

export type Departamento = (typeof DEPARTAMENTOS_HONDURAS)[number]['nombre'];

export function entregaEstimada(departamento: string): { diasMin: number; diasMax: number } {
  const dep = DEPARTAMENTOS_HONDURAS.find((d) => d.nombre === departamento);
  return dep ? { diasMin: dep.diasMin, diasMax: dep.diasMax } : { diasMin: 3, diasMax: 7 };
}

export const TALLAS_ROPA = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
export const TALLAS_CALZADO = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'] as const;

export const ESTADOS_ORDEN = [
  'pendiente',
  'pagado',
  'enviado',
  'entregado',
  'cancelado',
] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export const METODOS_PAGO = ['tarjeta', 'contra_entrega'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];

export const ROLES = ['cliente', 'admin'] as const;
export type Rol = (typeof ROLES)[number];

export const TIPOS_PROMOCION = ['porcentaje', 'monto_fijo'] as const;
export type TipoPromocion = (typeof TIPOS_PROMOCION)[number];

/** Identidad visual. Reemplazar LOGO_URL y PRIMARY cuando estén definitivos. */
export const MARCA = {
  nombre: 'Gina Boutique',
  logoUrl: 'https://placehold.co/320x120/B03052/FFFFFF?text=Gina+Boutique',
  colores: {
    /** Color principal de marca (placeholder hasta tener el definitivo). */
    primary: '#B03052',
    primaryDark: '#7E2039',
    accent: '#E8B4B8',
    fondo: '#FAF7F5',
    texto: '#1F1B1C',
    /** El marco blanco del checkout de pago. */
    marcoPago: '#FFFFFF',
  },
} as const;

export const PAGINACION = { limiteDefault: 24, limiteMax: 60 } as const;
