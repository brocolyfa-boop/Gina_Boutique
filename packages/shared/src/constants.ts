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

/**
 * Identidad visual de Gina Boutique. Color principal: blanco.
 *
 * Una marca blanca no puede pintar botones ni texto con su propio color, así que
 * la paleta se construye al revés de lo habitual: el blanco es el lienzo y el
 * contraste (`contraste`) es lo que se usa para tipografía, botones y bordes.
 * Nunca uses `primary` como color de texto ni de fondo de un botón.
 */
export const MARCA = {
  nombre: 'Gina Boutique',
  tagline: 'Descubre la moda que te hace brillar',
  /**
   * Monograma "GR" en negro sobre blanco. Placeholder hasta que el archivo esté
   * subido a Cloudinary; al reemplazar esta URL, web y mobile lo toman de aquí.
   *
   * El logo original incluye el texto "GR VARIEDADES", pero el nombre de la
   * tienda es Gina Boutique: el monograma se usa como imagen de marca (header,
   * favicon) y el nombre va aparte, en texto. No mezclar los dos rótulos.
   */
  logoUrl: 'https://placehold.co/320x320/FFFFFF/111111?text=GR',
  colores: {
    /** Color principal de marca: blanco. Es el lienzo, no la tinta. */
    primary: '#FFFFFF',
    /** Tinta de la marca: tipografía, botones e iconos sobre el blanco. */
    contraste: '#111111',
    /** Gris cálido para bordes y separadores; el blanco puro necesita límites. */
    borde: '#E5E2E0',
    /** Texto secundario, precios tachados, metadatos. */
    textoSuave: '#6B6663',
    /** Fondo de la página: un blanco roto, para que las tarjetas blancas resalten. */
    fondo: '#FAF9F8',
    /** Superficie de tarjetas y modales: blanco puro. */
    superficie: '#FFFFFF',
    /** Acento discreto para etiquetas de oferta y el badge del carrito. */
    acento: '#B03052',
    /** El marco blanco del checkout de pago (borde + fondo + sombra suave). */
    marcoPago: '#FFFFFF',
  },
  /**
   * Tipografía tomada del logo: serif de alto contraste para títulos, sans con
   * espaciado amplio en mayúsculas para etiquetas y el tagline.
   */
  tipografia: {
    display: "'Playfair Display', 'Cormorant Garamond', Georgia, serif",
    texto: "'Inter', 'Helvetica Neue', system-ui, sans-serif",
    /** Las etiquetas van en mayúsculas con este tracking, como en el logo. */
    trackingEtiqueta: '0.18em',
  },
} as const;

export const PAGINACION = { limiteDefault: 24, limiteMax: 60 } as const;
