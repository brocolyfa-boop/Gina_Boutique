/** Constantes compartidas entre api, web y mobile. */
export const MONEDA = 'HNL' as const;
export const MONEDA_SIMBOLO = 'L' as const;

/**
 * Tarifas de envío de la mensajería, en lempiras. No viven aquí como verdad
 * final: el backend las publica en `GET /api/config` leyéndolas del entorno,
 * para poder cambiarlas sin republicar la app de Android. Esto es solo el
 * respaldo por si el cliente aún no pudo leer la config.
 */
export const TARIFAS_ENVIO_FALLBACK = {
  tegucigalpa: 90,
  nacional: 120,
} as const;

export interface TarifasEnvio {
  /** Entregas dentro de Tegucigalpa. */
  tegucigalpa: number;
  /** El resto del país. */
  nacional: number;
}

/** Quita acentos y mayúsculas para comparar nombres escritos a mano. */
const normalizarTexto = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/**
 * La capital aparece escrita de varias formas y el cliente la teclea libremente.
 * Todas estas cuentan como "dentro de Tegucigalpa" para la tarifa.
 */
const MUNICIPIOS_CAPITAL = ['tegucigalpa', 'distrito central', 'comayaguela', 'mdc', 'd.c.'];

export function esTegucigalpa(departamento: string, municipio: string): boolean {
  if (normalizarTexto(departamento) !== 'francisco morazan') return false;
  const m = normalizarTexto(municipio);
  return MUNICIPIOS_CAPITAL.some((c) => m === c || m.includes(c));
}

/**
 * Cuánto cuesta enviar a una zona. La misma función la usan la web, la app y el
 * servidor: si divergieran, el cliente vería un total y pagaría otro.
 */
export function costoEnvioPara(
  departamento: string,
  municipio: string,
  tarifas: TarifasEnvio = TARIFAS_ENVIO_FALLBACK,
): number {
  return esTegucigalpa(departamento, municipio) ? tarifas.tegucigalpa : tarifas.nacional;
}

/**
 * Los 18 departamentos de Honduras con su rango de entrega en días.
 *
 * La mensajería entrega en 1 a 2 días en todo el país, así que hoy el rango es
 * igual en todos. Se mantiene por departamento porque es lo primero que va a
 * cambiar cuando se sumen zonas lejanas o una segunda mensajería.
 */
export const DEPARTAMENTOS_HONDURAS = [
  { nombre: 'Atlántida', diasMin: 1, diasMax: 2 },
  { nombre: 'Choluteca', diasMin: 1, diasMax: 2 },
  { nombre: 'Colón', diasMin: 1, diasMax: 2 },
  { nombre: 'Comayagua', diasMin: 1, diasMax: 2 },
  { nombre: 'Copán', diasMin: 1, diasMax: 2 },
  { nombre: 'Cortés', diasMin: 1, diasMax: 2 },
  { nombre: 'El Paraíso', diasMin: 1, diasMax: 2 },
  { nombre: 'Francisco Morazán', diasMin: 1, diasMax: 2 },
  { nombre: 'Gracias a Dios', diasMin: 1, diasMax: 2 },
  { nombre: 'Intibucá', diasMin: 1, diasMax: 2 },
  { nombre: 'Islas de la Bahía', diasMin: 1, diasMax: 2 },
  { nombre: 'La Paz', diasMin: 1, diasMax: 2 },
  { nombre: 'Lempira', diasMin: 1, diasMax: 2 },
  { nombre: 'Ocotepeque', diasMin: 1, diasMax: 2 },
  { nombre: 'Olancho', diasMin: 1, diasMax: 2 },
  { nombre: 'Santa Bárbara', diasMin: 1, diasMax: 2 },
  { nombre: 'Valle', diasMin: 1, diasMax: 2 },
  { nombre: 'Yoro', diasMin: 1, diasMax: 2 },
] as const;

export const DEPARTAMENTOS = DEPARTAMENTOS_HONDURAS.map((d) => d.nombre);

export type Departamento = (typeof DEPARTAMENTOS_HONDURAS)[number]['nombre'];

export function entregaEstimada(departamento: string): { diasMin: number; diasMax: number } {
  const dep = DEPARTAMENTOS_HONDURAS.find((d) => d.nombre === departamento);
  return dep ? { diasMin: dep.diasMin, diasMax: dep.diasMax } : { diasMin: 1, diasMax: 2 };
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
   * Monograma "GR" en negro sobre blanco, servido por la propia web
   * (`apps/web/public/logo.svg`). No es una imagen externa a propósito: un
   * logotipo que depende de otro servicio es lo primero que se ve fallar.
   *
   * Cuando exista el archivo definitivo, se sube a Cloudinary y se cambia esta
   * línea; web y mobile lo toman de aquí.
   *
   * El logo original incluye el texto "GR VARIEDADES", pero el nombre de la
   * tienda es Gina Boutique: el monograma se usa como imagen de marca (header,
   * favicon) y el nombre va aparte, en texto. No mezclar los dos rótulos.
   */
  logoUrl: '/logo.svg',
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
   * Redes y contacto de la tienda.
   *
   * El WhatsApp también llega por `TIENDA_WHATSAPP` desde el servidor; si esa
   * variable está puesta, manda ella. Este valor es el que hace que el botón
   * funcione sin depender de que alguien configure Railway.
   */
  redes: {
    instagram: 'https://instagram.com/ginaboutique200',
    /** Pendiente: falta el enlace real de la página. Vacío = no se muestra. */
    facebook: '',
    whatsapp: '8871-2141',
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

/* -------------------------------- WhatsApp -------------------------------- */

/**
 * Número de la tienda en formato internacional sin signos, como lo pide wa.me.
 * Honduras es +504. El valor real llega del servidor (`ConfigPublicaDTO`); este
 * queda como respaldo para que nada se rompa si la variable no está puesta.
 */
export const WHATSAPP_TIENDA_FALLBACK = '8871-2141';

/** Convierte "9999-8888" o "+504 9999 8888" en "50499998888". */
export function normalizarWhatsApp(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  if (!digitos) return '';
  // Ocho dígitos es un número hondureño sin el código de país.
  return digitos.length === 8 ? `504${digitos}` : digitos;
}

/** Enlace de chat con el texto ya escrito. Devuelve null si no hay número. */
export function enlaceWhatsApp(numero: string, mensaje: string): string | null {
  const destino = normalizarWhatsApp(numero);
  if (!destino) return null;
  return `https://wa.me/${destino}?text=${encodeURIComponent(mensaje)}`;
}

export const PAGINACION = { limiteDefault: 24, limiteMax: 60 } as const;
