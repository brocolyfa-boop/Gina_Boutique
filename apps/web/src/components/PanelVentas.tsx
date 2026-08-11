import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardDTO, PeriodoDashboard, PuntoSerie, VentaPorZona } from '@gina/shared';
import { DEPARTAMENTOS, PERIODOS_DASHBOARD, formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { Skeleton } from './ui';
import { BarraApilada, Dona, Medidor, colorSerie } from './graficos';

const ETIQUETA_PERIODO: Record<PeriodoDashboard, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  '90d': 'Últimos 90 días',
};

/* ------------------------------- utilidades ------------------------------- */

/**
 * Variación contra el periodo anterior. Devuelve null cuando antes no hubo
 * nada: un "+100%" sobre cero no informa, y un "+∞" asusta sin motivo.
 */
function variacion(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return Math.round(((actual - previo) / previo) * 100);
}

/** 2026-08-10 → "10 ago". Se parte la cadena para no cruzar husos horarios. */
function diaCorto(fecha: string): string {
  const [a = 1970, m = 1, d = 1] = fecha.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });
}

const entero = (n: number) => n.toLocaleString('es-HN');

/* --------------------------------- piezas --------------------------------- */

/** Celda del bloque de resumen: valor grande y su referencia debajo. */
function Cifra({
  titulo,
  valor,
  pie,
  delta,
}: {
  titulo: string;
  valor: string;
  pie: string;
  delta?: number | null;
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="etiqueta truncate">{titulo}</p>
      <p className="mt-2 font-display text-2xl leading-none lg:text-[1.75rem]">{valor}</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-suave">
        <span>{pie}</span>
        {delta != null && (
          <span className={delta < 0 ? 'text-acento' : 'text-verde'}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </p>
    </div>
  );
}

function Panel({
  titulo,
  nota,
  children,
  className = '',
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`tarjeta min-w-0 p-6 ${className}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg">{titulo}</h2>
        {nota && <span className="text-xs text-suave">{nota}</span>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Serie diaria en barras. Se dibuja con SVG y `preserveAspectRatio="none"`
 * para que se estire a lo ancho del contenedor: son rectángulos, así que
 * deformar la escala no los afea.
 */
function SerieDiaria({ serie }: { serie: PuntoSerie[] }) {
  const maximo = Math.max(...serie.map((p) => p.ventas), 1);
  const ancho = Math.max(serie.length, 1) * 10;

  const primero = serie[0];
  const ultimo = serie[serie.length - 1];
  if (!primero || !ultimo || serie.every((p) => p.ventas === 0)) {
    return <p className="py-10 text-center text-sm text-suave">Sin ventas en este periodo.</p>;
  }

  return (
    <>
      <svg
        viewBox={`0 0 ${ancho} 100`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Ventas por día"
        className="h-44 w-full"
      >
        {serie.map((p, i) => {
          const alto = (p.ventas / maximo) * 96;
          return (
            <rect
              key={p.fecha}
              x={i * 10 + 2}
              y={100 - alto}
              width={6}
              height={alto || 0.6}
              className="fill-tinta"
            >
              <title>{`${diaCorto(p.fecha)}: ${formatLps(p.ventas)} · ${p.pedidos} pedidos`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] text-suave">
        <span>{diaCorto(primero.fecha)}</span>
        <span>{formatLps(maximo)} máx.</span>
        <span>{diaCorto(ultimo.fecha)}</span>
      </div>
    </>
  );
}

/** Barras horizontales por zona. En HTML, no SVG: se lee y se copia mejor. */
function BarrasZona({ filas, vacio }: { filas: VentaPorZona[]; vacio: string }) {
  if (filas.length === 0) return <p className="text-sm text-suave">{vacio}</p>;
  const maximo = Math.max(...filas.map((f) => f.ventas), 1);

  return (
    <ul className="space-y-3">
      {filas.map((f) => (
        <li key={`${f.departamento}-${f.municipio ?? ''}`} className="min-w-0">
          <div className="flex min-w-0 items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">
              {f.municipio ? `${f.municipio}, ${f.departamento}` : f.departamento}
            </span>
            <span className="whitespace-nowrap text-suave">
              {formatLps(f.ventas)} · {f.porcentaje}%
            </span>
          </div>
          <div className="mt-1 h-2 w-full bg-fondo">
            <div className="h-2 bg-tinta" style={{ width: `${(f.ventas / maximo) * 100}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-suave">
            {f.pedidos} {f.pedidos === 1 ? 'pedido' : 'pedidos'}
          </p>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------- panel ---------------------------------- */

export default function PanelVentas() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('30d');
  const [departamento, setDepartamento] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'dashboard', periodo, departamento],
    queryFn: () =>
      api<DashboardDTO>(
        `/ordenes/admin/dashboard?periodo=${periodo}${
          departamento ? `&departamento=${encodeURIComponent(departamento)}` : ''
        }`,
      ),
    // Un supervisor deja esta pantalla abierta; que no se quede congelada.
    refetchInterval: 60_000,
  });

  const filtros = (
    <div className="tarjeta flex flex-wrap items-end gap-4 p-4">
      <label className="min-w-0">
        <span className="etiqueta">Periodo</span>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value as PeriodoDashboard)}
          className="campo mt-1 w-auto py-2 text-sm"
        >
          {PERIODOS_DASHBOARD.map((p) => (
            <option key={p} value={p}>
              {ETIQUETA_PERIODO[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="min-w-0">
        <span className="etiqueta">Departamento</span>
        <select
          value={departamento}
          onChange={(e) => setDepartamento(e.target.value)}
          className="campo mt-1 w-auto py-2 text-sm"
        >
          <option value="">Todos</option>
          {DEPARTAMENTOS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <button
        onClick={() => {
          setPeriodo('30d');
          setDepartamento('');
        }}
        className="btn-secundario px-4 py-2 text-xs"
      >
        Limpiar
      </button>
      <button
        onClick={() => void refetch()}
        className="ml-auto text-xs uppercase tracking-etiqueta text-suave hover:text-tinta"
      >
        {isFetching ? 'Actualizando…' : 'Actualizar'}
      </button>
    </div>
  );

  if (isError) {
    return (
      <div className="space-y-6">
        {filtros}
        <p className="text-sm text-acento">No se pudo cargar el reporte. Intenta de nuevo.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        {filtros}
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const { resumen: r, resumenPrevio: prev, catalogo: cat } = data;

  const pendientes = data.pedidosPorEstado.find((e) => e.estado === 'pendiente')?.pedidos ?? 0;
  const totalPedidos = data.pedidosPorEstado.reduce((t, e) => t + e.pedidos, 0);
  const atendidos = totalPedidos > 0 ? ((totalPedidos - pendientes) / totalPedidos) * 100 : 100;

  return (
    <div className="space-y-6">
      {filtros}

      {/* Franja de resumen, al estilo del tablero de referencia: una fila de
          cifras con su comparación, separadas por líneas finas. */}
      <div className="tarjeta">
        <p className="border-b border-borde px-5 py-3 text-sm">
          Resumen · {data.rango.etiqueta}
          {departamento && ` · ${departamento}`}
        </p>
        <div className="grid divide-y divide-borde sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Cifra
            titulo="Ventas"
            valor={formatLps(r.ventas)}
            pie={`antes ${formatLps(prev.ventas)}`}
            delta={variacion(r.ventas, prev.ventas)}
          />
          <Cifra
            titulo="Pedidos"
            valor={entero(r.pedidos)}
            pie={`antes ${entero(prev.pedidos)}`}
            delta={variacion(r.pedidos, prev.pedidos)}
          />
          <Cifra
            titulo="Ticket promedio"
            valor={formatLps(r.ticketPromedio)}
            pie={`antes ${formatLps(prev.ticketPromedio)}`}
            delta={variacion(r.ticketPromedio, prev.ticketPromedio)}
          />
          <Cifra
            titulo="Unidades vendidas"
            valor={entero(r.unidades)}
            pie={`antes ${entero(prev.unidades)}`}
            delta={variacion(r.unidades, prev.unidades)}
          />
        </div>
        <div className="grid divide-y divide-borde border-t border-borde sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <Cifra
            titulo="Productos"
            valor={entero(cat.productosActivos)}
            pie={`${entero(cat.productos)} en total · ${entero(cat.sinStock)} agotados`}
          />
          <Cifra titulo="Categorías" valor={entero(cat.categorias)} pie="en el catálogo" />
          <Cifra titulo="Clientes" valor={entero(cat.clientes)} pie="cuentas registradas" />
          <Cifra
            titulo="Inventario"
            valor={formatLps(cat.valorInventario)}
            pie={`${entero(cat.unidadesEnStock)} unidades en bodega`}
          />
        </div>
      </div>

      <Panel titulo="Ventas por día" nota={data.rango.etiqueta}>
        <SerieDiaria serie={data.serie} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel titulo="Ventas por departamento" className="lg:col-span-2">
          <BarrasZona filas={data.porDepartamento} vacio="Sin ventas por zona en este periodo." />
        </Panel>
        <Panel titulo="Pedidos por estado" nota="incluye cancelados">
          <Dona
            titulo="Pedidos por estado"
            total={totalPedidos}
            datos={data.pedidosPorEstado.map((e) => ({
              etiqueta: e.estado.replace(/_/g, ' '),
              valor: e.pedidos,
            }))}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel titulo="Ventas por categoría" nota="sin contar el envío" className="lg:col-span-2">
          <Dona
            titulo="Ventas por categoría"
            total={data.porCategoria.reduce((t, c) => t + c.ventas, 0)}
            centro={`L ${Math.round(
              data.porCategoria.reduce((t, c) => t + c.ventas, 0) / 1000,
            )} K`}
            formato={formatLps}
            datos={data.porCategoria.map((c) => ({ etiqueta: c.nombre, valor: c.ventas }))}
          />
        </Panel>
        <Panel titulo="Pedidos atendidos" nota="fuera de pendiente">
          <Medidor
            titulo="Pedidos atendidos"
            porcentaje={atendidos}
            etiqueta={`${entero(pendientes)} de ${entero(totalPedidos)} siguen pendientes`}
          />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel titulo="Municipios con más ventas">
          <BarrasZona
            filas={data.porMunicipio}
            vacio="Sin ventas por municipio en este periodo."
          />
        </Panel>

        <Panel titulo="Clientes que más compran">
          {data.topClientes.length === 0 ? (
            <p className="text-sm text-suave">Sin compras en este periodo.</p>
          ) : (
            <ul className="space-y-3">
              {data.topClientes.map((c, i) => (
                <BarraApilada
                  key={c.id}
                  nombre={c.nombre}
                  pie={`${formatLps(c.ventas)} · ${c.pedidos} ped.`}
                  partes={[
                    { etiqueta: 'Compras', valor: c.ventas, color: colorSerie(i) },
                    {
                      etiqueta: 'resto',
                      valor: Math.max(0, (data.topClientes[0]?.ventas ?? 0) - c.ventas),
                      color: 'transparent',
                    },
                  ]}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel titulo="Productos más vendidos">
          {data.masVendidos.length === 0 ? (
            <p className="text-sm text-suave">Todavía no hay ventas.</p>
          ) : (
            <ol className="divide-y divide-borde">
              {data.masVendidos.map((p, i) => (
                <li
                  key={p.productoId}
                  className="flex min-w-0 items-baseline justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-suave">{i + 1}</span>
                    {p.nombre}
                  </span>
                  <span className="whitespace-nowrap text-suave">
                    {entero(p.unidades)} u. · {formatLps(p.ventas)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel titulo="Stock bajo" nota="5 unidades o menos">
          {data.stockBajo.length === 0 ? (
            <p className="text-sm text-suave">Ningún producto por debajo de 5 unidades.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {data.stockBajo.map((p) => (
                <li
                  key={p.id}
                  className="flex min-w-0 items-baseline justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {p.nombre}
                    <span className="block text-[11px] text-suave">{p.categoria}</span>
                  </span>
                  <span className={p.stock === 0 ? 'text-acento' : 'text-suave'}>{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
