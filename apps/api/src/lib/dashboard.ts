import { Prisma } from '@prisma/client';
import type {
  DashboardDTO,
  PeriodoDashboard,
  ProductoVendido,
  PuntoSerie,
  ResumenVentas,
  VentaPorZona,
} from '@gina/shared';
import { redondear, type OrdenItemDTO } from '@gina/shared';
import { prisma } from '../prisma.js';
import { num } from './dto.js';

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

  return {
    unidades,
    masVendidos: [...mapa.values()].sort((a, b) => b.unidades - a.unidades).slice(0, 10),
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
  };
}
