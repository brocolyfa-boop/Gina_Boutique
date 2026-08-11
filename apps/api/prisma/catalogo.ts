/**
 * Carga el catálogo real de Gina Boutique.
 *
 *   npm run db:catalogo -w @gina/api
 *
 * Se separa del seed a propósito: el seed inventa datos de ejemplo para
 * desarrollo, y esto son las prendas de verdad. Correrlo dos veces no duplica
 * nada — hace upsert por SKU — y tampoco pisa las fotos que ya se hayan subido
 * desde el panel.
 *
 * Las fotos NO vienen aquí: llegaron dentro de las imágenes del catálogo de
 * Instagram y no hay forma de recortarlas desde el servidor. Cada prenda queda
 * con su monograma y "Foto en camino" hasta que se suban desde el panel.
 */
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Prenda {
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  tallas: string[];
  colores: string[];
  categoria: string;
  subcategoria: string;
  tipoPrenda: string;
}

/**
 * Transcrito del catálogo de la tienda. El stock no venía en él, así que cada
 * prenda entra con 1 por talla; hay que ajustarlo desde el panel antes de
 * publicar, o la tienda venderá lo que no hay.
 */
const PRENDAS: Prenda[] = [
  {
    sku: 'TB01-LEO',
    nombre: 'Top corto leopardo con pliegues',
    descripcion:
      'Top corto sin tirantes con pliegues estrechos y estampado total de leopardo para mujer. Tela elástica que se ajusta al cuerpo, con tira larga al cuello que se amarra al gusto.',
    precio: 290,
    tallas: ['XS', 'S', 'M', 'L', 'XL'],
    colores: ['Leopardo'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'TB02-LEO',
    nombre: 'Top corto leopardo con amarre al cuello',
    descripcion:
      'Top corto sin tirantes con pliegues estrechos y estampado total de leopardo para mujer. Escote recto y tira al cuello para amarrar.',
    precio: 290,
    tallas: ['M', 'L', 'XL'],
    colores: ['Leopardo'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'TB03-ROJO',
    nombre: 'Top corto rojo con amarre al cuello',
    descripcion:
      'Top corto sin tirantes con pliegues estrechos y tira larga al cuello. Rojo liso, en tela elástica que estiliza la silueta.',
    precio: 290,
    tallas: ['XS', 'S', 'M', 'L'],
    colores: ['Rojo'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'SB04-LEO',
    nombre: 'Suéter con estampado de leopardo',
    descripcion:
      'Suéter negro con cuello y puños en estampado de leopardo, cierre completo al frente y corte corto.',
    precio: 480,
    tallas: ['XS', 'S', 'M', 'L', 'XL'],
    colores: ['Negro'],
    categoria: 'mujer',
    subcategoria: 'conjuntos',
    tipoPrenda: 'Suéter',
  },
  {
    sku: 'TB05-NL',
    nombre: 'Top corto con fruncido lateral',
    descripcion: 'Top corto con fruncido lateral con cordón, sin mangas y cuello redondo.',
    precio: 250,
    tallas: ['XS', 'S'],
    colores: ['Rojo'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'TB06-MEZ',
    nombre: 'Top de mezclilla con botones',
    descripcion:
      'Top de mezclilla elegante para mujer, sin tirantes, con botones dorados al frente y corte entallado.',
    precio: 480,
    tallas: ['XS', 'L', 'XL'],
    colores: ['Mezclilla'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'TB07-NL',
    nombre: 'Paquete de 3 camisetas de punto acanalado',
    descripcion:
      'Paquete de 3 camisetas de punto acanalado con cuello alto, sin mangas. Incluye negro, blanco y vino.',
    precio: 540,
    tallas: ['S'],
    colores: ['Negro', 'Blanco', 'Vino'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Camiseta',
  },
  {
    sku: 'TB08-LISO',
    nombre: 'Set de 4 tops básicos manga corta',
    descripcion:
      '4 piezas de top básico manga corta en tela lisa, corte ajustado. Incluye negro, café, rojo y blanco.',
    precio: 660,
    tallas: ['XL'],
    colores: ['Negro', 'Café', 'Rojo', 'Blanco'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
  {
    sku: 'TB011-NL',
    nombre: 'Camiseta de canalé a rayas',
    descripcion:
      'Camiseta de tejido de canalé de rayas, corte corto y manga corta. Disponible en rojo y gris.',
    precio: 170,
    tallas: ['S', 'L'],
    colores: ['Gris', 'Rojo'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Camiseta',
  },
  {
    sku: 'TB012-CAN',
    nombre: 'Set de 3 tops de canalé deportivos',
    descripcion:
      'Set de 3 tops de canalé para hacer ejercicio, corte ajustado y sin mangas. Incluye negro, café y blanco.',
    precio: 480,
    tallas: ['L'],
    colores: ['Negro', 'Café', 'Blanco'],
    categoria: 'mujer',
    subcategoria: 'blusas',
    tipoPrenda: 'Top',
  },
];

async function main() {
  const categorias = await prisma.category.findMany({ select: { id: true, slug: true } });
  const idDe = new Map(categorias.map((c) => [c.slug, c.id]));

  let creados = 0;
  let actualizados = 0;

  for (const p of PRENDAS) {
    const categoriaId = idDe.get(p.categoria);
    if (!categoriaId) {
      throw new Error(`Falta la categoría "${p.categoria}". Corré primero el seed de categorías.`);
    }

    const comun = {
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: new Prisma.Decimal(p.precio),
      tallas: p.tallas,
      colores: p.colores,
      categoriaId,
      subcategoria: p.subcategoria,
      tipoPrenda: p.tipoPrenda,
      marca: 'Gina Boutique',
      activo: true,
    };

    const existente = await prisma.product.findUnique({ where: { sku: p.sku } });

    if (existente) {
      // Las imágenes y el stock quedan como estén: son lo que se administra
      // desde el panel, y volver a correr esto no debe deshacer ese trabajo.
      await prisma.product.update({ where: { sku: p.sku }, data: comun });
      actualizados += 1;
    } else {
      await prisma.product.create({
        data: { ...comun, sku: p.sku, imagenes: [], stock: p.tallas.length },
      });
      creados += 1;
    }
  }

  // Las prendas de ejemplo estorban en una tienda real, pero no se borran:
  // desactivarlas las saca de la tienda sin romper los pedidos que las
  // referencian ni los reportes de ventas históricos.
  const { count } = await prisma.product.updateMany({
    where: { sku: null, activo: true },
    data: { activo: false },
  });

  console.log(`Catálogo cargado: ${creados} nuevos, ${actualizados} actualizados.`);
  console.log(`Prendas de ejemplo desactivadas: ${count}.`);
  console.log('Falta subir las fotos y ajustar el stock desde el panel.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
