import { z } from 'zod';
import {
  DEPARTAMENTOS,
  ESTADOS_ORDEN,
  METODOS_PAGO,
  PAGINACION,
  TIPOS_PROMOCION,
} from './constants.js';

const departamentoSchema = z.enum(DEPARTAMENTOS as unknown as [string, ...string[]]);
const telefonoHN = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s-]{8,15}$/, 'Teléfono inválido (8 dígitos en Honduras)');

/* ---------------------------------- auth ---------------------------------- */

export const registroSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(80),
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  telefono: telefonoHN.optional(),
});
export type RegistroInput = z.infer<typeof registroSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export const actualizarPerfilSchema = z.object({
  nombre: z.string().trim().min(2).max(80).optional(),
  telefono: telefonoHN.optional(),
  direccion: z.string().trim().max(300).optional(),
});

export const cambiarPasswordSchema = z.object({
  actual: z.string().min(1, 'Ingresa tu contraseña actual'),
  nueva: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
});

/* -------------------------------- catálogo -------------------------------- */

export const listarProductosQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  categoria: z.string().trim().optional(),
  subcategoria: z.string().trim().optional(),
  talla: z.string().trim().optional(),
  color: z.string().trim().optional(),
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().positive().optional(),
  destacado: z.coerce.boolean().optional(),
  enOferta: z.coerce.boolean().optional(),
  orden: z.enum(['nuevos', 'precio_asc', 'precio_desc', 'nombre']).default('nuevos'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINACION.limiteMax).default(PAGINACION.limiteDefault),
});
export type ListarProductosQuery = z.infer<typeof listarProductosQuerySchema>;

/** Medidas de la prenda en centímetros. Un valor de 0 no dice nada útil. */
export const medidasPrendaSchema = z.object({
  pecho: z.number().positive().max(300).optional(),
  cintura: z.number().positive().max(300).optional(),
  cadera: z.number().positive().max(300).optional(),
  largo: z.number().positive().max(300).optional(),
  manga: z.number().positive().max(300).optional(),
  tiro: z.number().positive().max(300).optional(),
});

export const productoBaseSchema = z.object({
  nombre: z.string().trim().min(2).max(140),
  descripcion: z.string().trim().max(4000).default(''),
  precio: z.number().positive('El precio debe ser mayor a 0'),
  precioOferta: z.number().positive().nullable().optional(),
  ofertaInicio: z.coerce.date().nullable().optional(),
  ofertaFin: z.coerce.date().nullable().optional(),
  categoriaId: z.string().cuid(),
  subcategoria: z.string().trim().max(80).nullable().optional(),
  tallas: z.array(z.string().trim().min(1).max(10)).default([]),
  colores: z.array(z.string().trim().min(1).max(30)).default([]),
  stock: z.number().int().min(0).default(0),
  imagenes: z.array(z.string().url()).default([]),
  destacado: z.boolean().default(false),
  activo: z.boolean().default(true),

  sku: z.string().trim().max(60).nullable().optional(),
  marca: z.string().trim().max(80).nullable().optional(),
  material: z.string().trim().max(120).nullable().optional(),
  tipoPrenda: z.string().trim().max(80).nullable().optional(),
  medidas: medidasPrendaSchema.nullable().optional(),

  pesoGramos: z.number().int().positive().max(100000).nullable().optional(),
  altoCm: z.number().positive().max(500).nullable().optional(),
  anchoCm: z.number().positive().max(500).nullable().optional(),
  largoCm: z.number().positive().max(500).nullable().optional(),
});

/**
 * Dos reglas que el formulario no debería poder saltarse: la oferta tiene que
 * ser más barata que el precio, y su ventana tiene que ir hacia adelante.
 */
const reglasOferta = <T extends z.ZodTypeAny>(schema: T) =>
  schema
    .refine(
      (p: z.infer<T>) =>
        p.precioOferta == null || p.precio == null || p.precioOferta < p.precio,
      { message: 'El precio de oferta debe ser menor al precio normal', path: ['precioOferta'] },
    )
    .refine(
      (p: z.infer<T>) => !p.ofertaInicio || !p.ofertaFin || p.ofertaFin > p.ofertaInicio,
      { message: 'La oferta debe terminar después de empezar', path: ['ofertaFin'] },
    );

export const productoInputSchema = reglasOferta(productoBaseSchema);
export type ProductoInput = z.infer<typeof productoBaseSchema>;

export const productoUpdateSchema = reglasOferta(productoBaseSchema.partial());

export const categoriaInputSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'El slug solo admite minúsculas, números y guiones'),
  imagen: z.string().url().nullable().optional(),
  orden: z.number().int().min(0).default(0),
  subcategorias: z.array(z.string().trim().min(1).max(60)).default([]),
});
export type CategoriaInput = z.infer<typeof categoriaInputSchema>;

/** Forma base sin refinamientos, para poder derivar el schema de update parcial. */
export const promocionBaseSchema = z.object({
  titulo: z.string().trim().min(2).max(120),
  descripcion: z.string().trim().max(600).default(''),
  tipo: z.enum(TIPOS_PROMOCION),
  valor: z.number().positive(),
  productoIds: z.array(z.string().cuid()).default([]),
  categoriaId: z.string().cuid().nullable().optional(),
  fechaInicio: z.coerce.date(),
  fechaFin: z.coerce.date(),
  bannerImagen: z.string().url().nullable().optional(),
  activo: z.boolean().default(true),
});

export const promocionInputSchema = promocionBaseSchema
  .refine((p) => p.fechaFin > p.fechaInicio, {
    message: 'La fecha final debe ser posterior a la inicial',
    path: ['fechaFin'],
  })
  .refine((p) => p.tipo !== 'porcentaje' || p.valor <= 100, {
    message: 'Un descuento porcentual no puede pasar de 100',
    path: ['valor'],
  });
export type PromocionInput = z.infer<typeof promocionInputSchema>;

export const promocionUpdateSchema = promocionBaseSchema
  .partial()
  .refine((p) => !p.fechaInicio || !p.fechaFin || p.fechaFin > p.fechaInicio, {
    message: 'La fecha final debe ser posterior a la inicial',
    path: ['fechaFin'],
  });

/* --------------------------------- carrito -------------------------------- */

export const cartItemSchema = z.object({
  productoId: z.string().cuid(),
  cantidad: z.number().int().min(1).max(50),
  talla: z.string().trim().max(10).nullable().optional(),
  color: z.string().trim().max(30).nullable().optional(),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

export const cartSyncSchema = z.object({ items: z.array(cartItemSchema).max(100) });

/* -------------------------------- direcciones ------------------------------ */

export const direccionEnvioSchema = z.object({
  nombreCompleto: z.string().trim().min(3).max(120),
  telefonoContacto: telefonoHN,
  departamento: departamentoSchema,
  municipio: z.string().trim().min(2).max(80),
  direccionCompleta: z.string().trim().min(8, 'Sé más específico con la dirección').max(300),
  referencia: z.string().trim().max(200).optional(),
});
export type DireccionEnvioInput = z.infer<typeof direccionEnvioSchema>;

export const addressInputSchema = direccionEnvioSchema.extend({
  alias: z.string().trim().min(2).max(40),
  esPrincipal: z.boolean().default(false),
});

/* --------------------------------- órdenes -------------------------------- */

export const crearOrdenSchema = z.object({
  items: z.array(cartItemSchema).min(1, 'El carrito está vacío'),
  envio: direccionEnvioSchema,
  /**
   * Solo para compras de invitado, y opcional incluso ahí: en Honduras mucha
   * gente compra sin dar correo. El contacto obligatorio es el teléfono, que ya
   * viene en `envio`.
   */
  emailCliente: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  metodoPago: z.enum(METODOS_PAGO),
  /**
   * Token de tarjeta generado en el cliente por el SDK de PixelPay.
   * Requerido cuando metodoPago = 'tarjeta'. Nunca se aceptan PAN ni CVV aquí.
   */
  pagoToken: z.string().min(6).optional(),
  notas: z.string().trim().max(300).optional(),
});
export type CrearOrdenInput = z.infer<typeof crearOrdenSchema>;

export const actualizarEstadoOrdenSchema = z.object({
  estado: z.enum(ESTADOS_ORDEN),
});

/**
 * Enlace de cobro del pedido. Cadena vacía = quitarlo.
 *
 * Se exige https: un enlace de pago que viaja por http es exactamente lo que
 * un atacante en la misma red sabría aprovechar, y ningún banco serio los
 * emite así.
 */
export const enlacePagoSchema = z.object({
  enlacePago: z
    .union([
      z.literal(''),
      z
        .string()
        .trim()
        .url('Eso no parece una dirección web')
        .refine((u) => u.startsWith('https://'), 'El enlace debe empezar con https://'),
    ])
    .transform((v) => (v === '' ? null : v)),
});
