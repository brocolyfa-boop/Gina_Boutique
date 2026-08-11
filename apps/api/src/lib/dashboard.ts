import { Prisma } from '@prisma/client';
import type {
  ClienteTop,
  DashboardDTO,
  PeriodoDashboard,
  ProductoVendido,
  PuntoSerie,
  ResumenCatalogo,
  ResumenVentas,
  VentaPorCategoria,
  VentaPorZona,
} from '@gina/shared';
import { precioFinal, redondear, type OrdenItemDTO } from '@gina/shared';
import { prisma } from '../prisma.js';
import { num, numOrNull } from './dto.js';

/**
 * Honduras es UTC-6. Sin esto, una venta de las 7 de la noche del lunes (que en
 * UTC ya es martes) se contaría en el día equivocado, y el gráfico diario y el
 * filtro "hoy" mentirían.
 */
const ZONA = 'America/Tegucigalpa';

/**
 * Inicio del día de hoy en hora de Honduras, expresado en UTC.
 *
 * El desfase se escribe fijo (-06:00) porque Honduras no cambia de hora en todo
 * el año; si algún día lo hiciera, este es el único punto que habría que tocar.
 */
function inicioDeHoy(): Date {
  // 'en-CA' formatea como YYYY-MM-DD, que es lo que necesita el constructor.
  const hoyEnHonduras = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
  return new Date(`${hoyEnHonduras}T00:00:00-06:00`);
}

const DIAS: Record<PeriodoDashboard, number> = { hoy: 1, '7d': 7, '30d': 30, '90d': 90 };

const ETIQUETAS: Record<PeriodoDashboard, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
};

export function rangoDe(periodo: PeriodoDashboard): { desde: Date; hasta: Date; etiqueta: string } {
  const hasta = new Date();
  const desde = new Date(inicioDeHoy().getTime() - (DIAS[periodo] - 1) * 86400000);
  return { desde, hasta, etiqueta: ETIQUETAS[periodo] };
}

const VENDIDAS: Prisma.OrderWhereInput = { estado: { not: 'cancelado' } };

/** Cuenta unidades y ventas por producto a partir del snapshot de cada orden. */
function agregarItems(ordenes: Array<{ items: Prisma.JsonValue }>): {
  unidades: number;
  masVendidos: ProductoVendido[];
  todos: ProductoVendido[];
} {
  const mapa = new Map<string, ProductoVendido>();
  let unidades = 0;

  for (const orden of ordenes) {
    for (const item of orden.items as unknown as OrdenItemDTO[]) {
      unidades += item.cantidad;
      // Se agrupa por el snapshot, no por el producto vivo: si se borró o le
      // cambiaron el nombre, la venta histórica sigue contando igual.
      const actual = mapa.get(item.productoId) ?? {
        productoId: item.productoId,
        nombre: item.nombre,
        unidades: 0,
        ventas: 0,
      };
      actual.unidades += item.cantidad;
      actual.ventas = redondear(actual.ventas + item.precioUnitario * item.cantidad);
      mapa.set(item.productoId, actual);
    }
  }

  const todos = [...mapa.values()].sort((a, b) => b.unidades - a.unidades);
  return { unidades, masVendidos: todos.slice(0, 10), todos };
}

/**
 * Ventas por categoría. Se resuelve en dos pasos porque el snapshot de la orden
 * guarda el producto, no su categoría: primero se agrupan las unidades por
 * producto y luego se consulta a qué categoría pertenece cada uno.
 *
 * Un producto borrado del catálogo cae en "Otras": la venta ocurrió y tiene que
 * seguir sumando aunque el producto ya no exista.
 */
async function categoriasDe(
  ordenes: Array<{ items: Prisma.JsonValue }>,
): Promise<VentaPorCategoria[]> {
  const porProducto = agregarItems(ordenes).todos;
  if (porProducto.length === 0) return [];

  const productos = await prisma.product.findMany({
    where: { id: { in: porProducto.map((p) => p.productoId) } },
    select: { id: true, categoriaId: true, categoria: { select: { nombre: true } } },
  });
  const categoriaDe = new Map(productos.map((p) => [p.id, p]));

  const mapa = new Map<string, VentaPorCategoria>();
  for (const p of porProducto) {
    const cat = categoriaDe.get(p.productoId);
    const id = cat?.categoriaId ?? 'otras';
    const actual = mapa.get(id) ?? {
      categoriaId: id,
      nombre: cat?.categoria.nombre ?? 'Otras',
      unidades: 0,
      ventas: 0,
      porcentaje: 0,
    };
    actual.unidades += p.unidades;
    actual.ventas = redondear(actual.ventas + p.ventas);
    mapa.set(id, actual);
  }

  // El porcentaje se saca sobre la venta de artículos, no sobre el total de las
  // órdenes: ese total incluye el envío, que no pertenece a ninguna categoría, y
  // los porcentajes no sumarían 100.
  const base = [...mapa.values()].reduce((t, c) => t + c.ventas, 0) || 1;
  return [...mapa.values()]
    .map((c) => ({ ...c, porcentaje: Math.round((c.ventas / base) * 100) }))
    .sort((a, b) => b.ventas - a.ventas);
}

/** Clientes que más compraron en el periodo. */
async function clientesDe(where: Prisma.OrderWhereInput): Promise<ClienteTop[]> {
  const grupos = await prisma.order.groupBy({
    by: ['userId'],
    where,
    _sum: { total: true },
    _count: true,
    orderBy: { _sum: { total: 'desc' } },
    take: 8,
  });
  if (grupos.length === 0) return [];

  const usuarios = await prisma.user.findMany({
    where: { id: { in: grupos.map((g) => g.userId) } },
    select: { id: true, nombre: true, email: true },
  });
  const porId = new Map(usuarios.map((u) => [u.id, u]));

  return grupos.map((g) => ({
    id: g.userId,
    // Un usuario borrado deja sus órdenes atrás; no se pierde la venta.
    nombre: porId.get(g.userId)?.nombre ?? 'Cuenta eliminada',
    email: porId.get(g.userId)?.email ?? '',
    pedidos: g._count,
    ventas: redondear(num(g._sum.total)),
  }));
}

/** Estado del catálogo hoy. No depende del periodo: es una foto del inventario. */
async function catalogoAhora(): Promise<ResumenCatalogo> {
  const [productos, activos, categorias, clientes, sinStock, agg] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { activo: true } }),
    prisma.category.count(),
    prisma.user.count({ where: { rol: 'cliente' } }),
    prisma.product.count({ where: { activo: true, stock: 0 } }),
    prisma.product.aggregate({ where: { activo: true }, _sum: { stock: true } }),
  ]);

  // El valor del inventario necesita precio × stock por fila, que `aggregate`
  // no sabe hacer; se traen las dos columnas y se multiplica aquí.
  const filas = await prisma.product.findMany({
    where: { activo: true },
    select: { precio: true, precioOferta: true, stock: true, ofertaInicio: true, ofertaFin: true },
  });
  const valorInventario = redondear(
    filas.reduce(
      (t, f) =>
        t +
        precioFinal(num(f.precio), numOrNull(f.precioOferta), {
          inicio: f.ofertaInicio,
          fin: f.ofertaFin,
        }) *
          f.stock,
      0,
    ),
  );

  return {
    productos,
    productosActivos: activos,
    categorias,
    clientes,
    unidadesEnStock: agg._sum.stock ?? 0,
    valorInventario,
    sinStock,
  };
}

async function resumenDe(where: Prisma.OrderWhereInput): Promise<ResumenVentas> {
  const [agg, ordenes] = await Promise.all([
    prisma.order.aggregate({ where, _sum: { total: true }, _count: true }),
    prisma.order.findMany({ where, select: { items: true } }),
  ]);
  const ventas = redondear(num(agg._sum.total));
  const pedidos = agg._count;
  return {
    ventas,
    pedidos,
    ticketPromedio: pedidos > 0 ? redondear(ventas / pedidos) : 0,
    unidades: agregarItems(ordenes).unidades,
  };
}

export async function construirDashboard(
  periodo: PeriodoDashboard,
  departamento?: string,
): Promise<DashboardDTO> {
  const { desde, hasta, etiqueta } = rangoDe(periodo);
  const duracion = hasta.getTime() - desde.getTime();
  const desdePrevio = new Date(desde.getTime() - duracion);

  const filtroZona: Prisma.OrderWhereInput = departamento ? { departamento } : {};
  const where: Prisma.OrderWhereInput = {
    ...VENDIDAS,
    ...filtroZona,
    createdAt: { gte: desde, lte: hasta },
  };
  const wherePrevio: Prisma.OrderWhereInput = {
    ...VENDIDAS,
    ...filtroZona,
    createdAt: { gte: desdePrevio, lt: desde },
  };

  const [resumen, resumenPrevio, porDep, porMun, ordenes, porEstado, stockBajo, serieCruda] =
    await Promise.all([
      resumenDe(where),
      resumenDe(wherePrevio),
      prisma.order.groupBy({
        by: ['departamento'],
        where,
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ['departamento', 'municipio'],
        where,
        _sum: { total: true },
        _count: true,
      }),
      prisma.order.findMany({ where, select: { items: true } }),
      prisma.order.groupBy({
        by: ['estado'],
        where: { ...filtroZona, createdAt: { gte: desde, lte: hasta } },
        _count: true,
      }),
      prisma.product.findMany({
        where: { activo: true, stock: { lte: 5 } },
        select: { id: true, nombre: true, stock: true, categoria: { select: { nombre: true } } },
        orderBy: { stock: 'asc' },
        take: 12,
      }),
      // El agrupado por día se hace en Postgres y en hora de Honduras: en UTC,
      // una venta de la tarde caería en el día siguiente.
      prisma.$queryRaw<Array<{ dia: Date; ventas: Prisma.Decimal; pedidos: bigint }>>`
        SELECT date_trunc('day', created_at AT TIME ZONE ${ZONA}) AS dia,
               SUM(total) AS ventas,
               COUNT(*)   AS pedidos
        FROM orders
        WHERE estado <> 'cancelado'
          AND created_at >= ${desde}
          AND created_at <= ${hasta}
          ${departamento ? Prisma.sql`AND departamento = ${departamento}` : Prisma.empty}
        GROUP BY 1
        ORDER BY 1
      `,
    ]);

  const [porCategoria, topClientes, catalogo] = await Promise.all([
    categoriasDe(ordenes),
    clientesDe(where),
    catalogoAhora(),
  ]);

  const totalVentas = resumen.ventas || 1;
  const aZona = (d: {
    departamento: string;
    municipio?: string;
    _sum: { total: Prisma.Decimal | null };
    _count: number;
  }): VentaPorZona => {
    const ventas = redondear(num(d._sum.total));
    return {
      departamento: d.departamento,
      ...(d.municipio ? { municipio: d.municipio } : {}),
      pedidos: d._count,
      ventas,
      porcentaje: Math.round((ventas / totalVentas) * 100),
    };
  };

  /** Los días sin ventas también van, si no el gráfico miente sobre la tendencia. */
  const porDia = new Map(
    serieCruda.map((f) => [
      f.dia.toISOString().slice(0, 10),
      { ventas: redondear(num(f.ventas)), pedidos: Number(f.pedidos) },
    ]),
  );
  const serie: PuntoSerie[] = [];
  for (let t = desde.getTime(); t <= hasta.getTime(); t += 86400000) {
    const fecha = new Date(t).toISOString().slice(0, 10);
    const v = porDia.get(fecha);
    serie.push({ fecha, ventas: v?.ventas ?? 0, pedidos: v?.pedidos ?? 0 });
  }

  return {
    rango: { desde: desde.toISOString(), hasta: hasta.toISOString(), etiqueta },
    resumen,
    resumenPrevio,
    porDepartamento: [...porDep].map(aZona).sort((a, b) => b.ventas - a.ventas),
    porMunicipio: [...porMun].map(aZona).sort((a, b) => b.ventas - a.ventas).slice(0, 10),
    serie,
    masVendidos: agregarItems(ordenes).masVendidos,
    stockBajo: stockBajo.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      stock: p.stock,
      categoria: p.categoria.nombre,
    })),
    pedidosPorEstado: porEstado.map((e) => ({ estado: e.estado, pedidos: e._count })),
    porCategoria,
    topClientes,
    catalogo,
  };
}
