/**
 * Seed de datos de prueba para Gina Boutique.
 * Correr con: npm run db:seed -w @gina/api
 * Es idempotente: usa upsert por slug/email, así que se puede repetir.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Placeholders en blanco con tinta negra, alineados con la identidad de la marca.
const img = (texto: string, fondo = 'FFFFFF', tinta = '111111') =>
  `https://placehold.co/800x1000/${fondo}/${tinta}?text=${encodeURIComponent(texto)}`;

const CATEGORIAS = [
  {
    nombre: 'Mujer',
    slug: 'mujer',
    orden: 1,
    imagen: img('Mujer'),
    subcategorias: ['vestidos', 'blusas', 'pantalones', 'faldas', 'conjuntos'],
  },
  {
    nombre: 'Hombre',
    slug: 'hombre',
    orden: 2,
    imagen: img('Hombre'),
    subcategorias: ['camisas', 'camisetas', 'pantalones', 'shorts'],
  },
  {
    nombre: 'Niños',
    slug: 'ninos',
    orden: 3,
    imagen: img('Ninos'),
    subcategorias: ['niña', 'niño', 'bebé'],
  },
  {
    nombre: 'Calzado',
    slug: 'calzado',
    orden: 4,
    imagen: img('Calzado', '111111', 'FFFFFF'),
    subcategorias: ['sandalias', 'tenis', 'tacones', 'botas'],
  },
  {
    nombre: 'Accesorios',
    slug: 'accesorios',
    orden: 5,
    imagen: img('Accesorios'),
    subcategorias: ['bolsos', 'joyería', 'cinturones', 'lentes'],
  },
];

const TALLAS = ['XS', 'S', 'M', 'L', 'XL'];
const CALZADO = ['36', '37', '38', '39', '40'];

interface SeedProducto {
  nombre: string;
  descripcion: string;
  precio: number;
  precioOferta?: number;
  categoria: string;
  subcategoria: string;
  tallas: string[];
  colores: string[];
  stock: number;
  destacado?: boolean;
}

const PRODUCTOS: SeedProducto[] = [
  {
    nombre: 'Vestido midi floral Valentina',
    descripcion: 'Vestido midi de gasa con estampado floral, manga corta y cinturón de tela.',
    precio: 890,
    precioOferta: 690,
    categoria: 'mujer',
    subcategoria: 'vestidos',
    tallas: TALLAS,
    colores: ['Rosa', 'Azul marino', 'Negro'],
    stock: 24,
    destacado: true,
  },
  {
    nombre: 'Blusa de lino Isabela',
    descripcion: 'Blusa de lino fresco, corte holgado, ideal para el clima de la costa.',
    precio: 520,
    categoria: 'mujer',
    subcategoria: 'blusas',
    tallas: TALLAS,
    colores: ['Blanco', 'Beige', 'Verde oliva'],
    stock: 30,
    destacado: true,
  },
  {
    nombre: 'Jeans tiro alto Skinny',
    descripcion: 'Denim elástico de tiro alto con acabado desgastado.',
    precio: 780,
    precioOferta: 599,
    categoria: 'mujer',
    subcategoria: 'pantalones',
    tallas: ['S', 'M', 'L', 'XL'],
    colores: ['Azul claro', 'Azul oscuro', 'Negro'],
    stock: 18,
  },
  {
    nombre: 'Falda plisada Camila',
    descripcion: 'Falda plisada midi con pretina elástica.',
    precio: 450,
    categoria: 'mujer',
    subcategoria: 'faldas',
    tallas: TALLAS,
    colores: ['Vino', 'Negro'],
    stock: 15,
  },
  {
    nombre: 'Conjunto deportivo Luna',
    descripcion: 'Conjunto de top y leggings de tela técnica, alta compresión.',
    precio: 950,
    categoria: 'mujer',
    subcategoria: 'conjuntos',
    tallas: TALLAS,
    colores: ['Negro', 'Gris', 'Rosa'],
    stock: 12,
    destacado: true,
  },
  {
    nombre: 'Camisa slim fit Andrés',
    descripcion: 'Camisa de algodón peinado, corte slim, cuello italiano.',
    precio: 690,
    precioOferta: 549,
    categoria: 'hombre',
    subcategoria: 'camisas',
    tallas: ['S', 'M', 'L', 'XL', 'XXL'],
    colores: ['Blanco', 'Celeste', 'Negro'],
    stock: 22,
  },
  {
    nombre: 'Camiseta básica premium',
    descripcion: 'Algodón 100% peinado 180 g, cuello reforzado.',
    precio: 320,
    categoria: 'hombre',
    subcategoria: 'camisetas',
    tallas: ['S', 'M', 'L', 'XL', 'XXL'],
    colores: ['Blanco', 'Negro', 'Gris', 'Azul'],
    stock: 60,
  },
  {
    nombre: 'Pantalón chino casual',
    descripcion: 'Chino de gabardina con licra, corte recto.',
    precio: 720,
    categoria: 'hombre',
    subcategoria: 'pantalones',
    tallas: ['S', 'M', 'L', 'XL'],
    colores: ['Beige', 'Azul marino', 'Verde'],
    stock: 17,
  },
  {
    nombre: 'Short de playa Roatán',
    descripcion: 'Short de secado rápido con cordón ajustable.',
    precio: 390,
    precioOferta: 299,
    categoria: 'hombre',
    subcategoria: 'shorts',
    tallas: ['S', 'M', 'L', 'XL'],
    colores: ['Turquesa', 'Coral', 'Negro'],
    stock: 25,
  },
  {
    nombre: 'Vestido de niña Margarita',
    descripcion: 'Vestido de algodón con moño y vuelo, para fiestas.',
    precio: 420,
    categoria: 'ninos',
    subcategoria: 'niña',
    tallas: ['2', '4', '6', '8', '10'],
    colores: ['Rosa', 'Lila', 'Blanco'],
    stock: 20,
    destacado: true,
  },
  {
    nombre: 'Conjunto niño explorador',
    descripcion: 'Camiseta y short de algodón, estampado divertido.',
    precio: 380,
    categoria: 'ninos',
    subcategoria: 'niño',
    tallas: ['2', '4', '6', '8'],
    colores: ['Azul', 'Verde'],
    stock: 18,
  },
  {
    nombre: 'Sandalias de tacón Elena',
    descripcion: 'Sandalia de tacón 8 cm con tiras acolchadas.',
    precio: 890,
    precioOferta: 690,
    categoria: 'calzado',
    subcategoria: 'tacones',
    tallas: CALZADO,
    colores: ['Nude', 'Negro', 'Dorado'],
    stock: 14,
    destacado: true,
  },
  {
    nombre: 'Tenis urbanos Nova',
    descripcion: 'Tenis de suela ligera con plantilla de memoria.',
    precio: 1150,
    categoria: 'calzado',
    subcategoria: 'tenis',
    tallas: [...CALZADO, '41', '42'],
    colores: ['Blanco', 'Negro'],
    stock: 21,
  },
  {
    nombre: 'Bolso tote Gina',
    descripcion: 'Bolso tote de cuero sintético con bolsillo interior con cierre.',
    precio: 780,
    precioOferta: 620,
    categoria: 'accesorios',
    subcategoria: 'bolsos',
    tallas: [],
    colores: ['Café', 'Negro', 'Vino'],
    stock: 16,
    destacado: true,
  },
  {
    nombre: 'Set de aretes dorados',
    descripcion: 'Set de 3 pares de aretes con baño de oro, hipoalergénicos.',
    precio: 250,
    categoria: 'accesorios',
    subcategoria: 'joyería',
    tallas: [],
    colores: ['Dorado'],
    stock: 40,
  },
];

async function main() {
  console.log('Sembrando categorías…');
  const categoriasPorSlug = new Map<string, string>();
  for (const c of CATEGORIAS) {
    const guardada = await prisma.category.upsert({
      where: { slug: c.slug },
      update: c,
      create: c,
    });
    categoriasPorSlug.set(c.slug, guardada.id);
  }

  console.log('Sembrando productos…');
  const idsPorNombre = new Map<string, string>();
  for (const p of PRODUCTOS) {
    const categoriaId = categoriasPorSlug.get(p.categoria);
    if (!categoriaId) throw new Error(`Categoría desconocida en el seed: ${p.categoria}`);

    const datos = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      precioOferta: p.precioOferta ?? null,
      categoriaId,
      subcategoria: p.subcategoria,
      tallas: p.tallas,
      colores: p.colores,
      stock: p.stock,
      imagenes: [
        img(p.nombre.split(' ')[0] ?? 'Gina'),
        img(p.nombre.split(' ')[0] ?? 'Gina', 'F5F3F1'),
      ],
      destacado: p.destacado ?? false,
      activo: true,
    };

    // No hay unique en nombre, así que buscamos antes para no duplicar al re-sembrar.
    const existente = await prisma.product.findFirst({ where: { nombre: p.nombre } });
    const guardado = existente
      ? await prisma.product.update({ where: { id: existente.id }, data: datos })
      : await prisma.product.create({ data: datos });
    idsPorNombre.set(p.nombre, guardado.id);
  }

  console.log('Sembrando promociones…');
  const ahora = new Date();
  const en10Dias = new Date(ahora.getTime() + 10 * 24 * 60 * 60 * 1000);
  const en3Dias = new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000);

  const promos = [
    {
      titulo: 'Temporada de Vestidos — 25% OFF',
      descripcion: 'Descuento en toda la línea de vestidos y blusas de mujer.',
      tipo: 'porcentaje' as const,
      valor: 25,
      categoriaId: categoriasPorSlug.get('mujer') ?? null,
      productoIds: [],
      fechaInicio: ahora,
      fechaFin: en10Dias,
      bannerImagen: 'https://placehold.co/1600x600/FFFFFF/111111?text=25%25+OFF+Vestidos',
      activo: true,
    },
    {
      titulo: 'L 100 de descuento en calzado',
      descripcion: 'Solo por 3 días: L 100 menos en sandalias y tenis seleccionados.',
      tipo: 'monto_fijo' as const,
      valor: 100,
      categoriaId: null,
      productoIds: [
        idsPorNombre.get('Sandalias de tacón Elena'),
        idsPorNombre.get('Tenis urbanos Nova'),
      ].filter((id): id is string => Boolean(id)),
      fechaInicio: ahora,
      fechaFin: en3Dias,
      bannerImagen: 'https://placehold.co/1600x600/111111/FFFFFF?text=L+100+OFF+Calzado',
      activo: true,
    },
  ];

  for (const promo of promos) {
    const existente = await prisma.promotion.findFirst({ where: { titulo: promo.titulo } });
    if (existente) {
      await prisma.promotion.update({ where: { id: existente.id }, data: promo });
    } else {
      await prisma.promotion.create({ data: promo });
    }
  }

  console.log('Sembrando usuarios de prueba…');
  await prisma.user.upsert({
    where: { email: 'admin@ginaboutique.hn' },
    update: { rol: 'admin' },
    create: {
      nombre: 'Administración Gina',
      email: 'admin@ginaboutique.hn',
      // Credenciales SOLO para desarrollo local. Cambiar antes de producción.
      passwordHash: await bcrypt.hash('Admin1234!', 12),
      rol: 'admin',
      telefono: '9999-0000',
    },
  });
  await prisma.user.upsert({
    where: { email: 'cliente@ginaboutique.hn' },
    update: {},
    create: {
      nombre: 'Cliente de Prueba',
      email: 'cliente@ginaboutique.hn',
      passwordHash: await bcrypt.hash('Cliente1234!', 12),
      telefono: '8888-1111',
      direccion: 'Col. Kennedy, Tegucigalpa',
    },
  });

  console.log(
    `Listo: ${CATEGORIAS.length} categorías, ${PRODUCTOS.length} productos, ${promos.length} promociones, 2 usuarios.`,
  );
  console.log('Admin de prueba: admin@ginaboutique.hn / Admin1234!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
