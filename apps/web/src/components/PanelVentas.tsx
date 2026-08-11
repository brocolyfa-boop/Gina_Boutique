import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DashboardDTO, PeriodoDashboard, PuntoSerie, VentaPorZona } from '@gina/shared';
import { DEPARTAMENTOS, PERIODOS_DASHBOARD, formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { Skeleton } from './ui';

const ETIQUETA_PERIODO: Record<PeriodoDashboard, string> = {
  hoy: 'Hoy',
  '7d': '7 días',
  '30d': '30 días',
  '90d': '90 días',
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

/* --------------------------------- piezas --------------------------------- */

function Tarjeta({
  titulo,
  valor,
  pie,
  delta,
}: {
  titulo: string;
  valor: string;
  pie: string;
  delta: number | null;
}) {
  return (
    <div className="tarjeta min-w-0 p-5">
      <p className="etiqueta">{titulo}</p>
      <p className="mt-3 font-display text-2xl lg:text-3xl">{valor}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-suave">
        <span>{pie}</span>
        {delta !== null && (
          <span className={delta < 0 ? 'text-acento' : 'text-tinta'}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </p>
    </div>
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
  if (filas.length === 0) return <p className="mt-4 text-sm text-suave">{vacio}</p>;
  const maximo = Math.max(...filas.map((f) => f.ventas), 1);

  return (
    <ul className="mt-4 space-y-3">
      {filas.map((f) => (
        <li key={`${f.departamento}-${f.municipio ?? ''}`}>
          <div className="flex min-w-0 items-baseline justify-between gap-4 text-sm">
            <span className="min-w-0 truncate">{f.municipio ? `${f.municipio}, ${f.departamento}` : f.departamento}</span>
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

  const { data, isLoading, isError } = useQuery({
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
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap gap-2">
        {PERIODOS_DASHBOARD.map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`border px-3 py-1 text-xs uppercase tracking-etiqueta transition ${
              periodo === p ? 'border-tinta bg-tinta text-white' : 'border-borde hover:border-tinta'
            }`}
          >
            {ETIQUETA_PERIODO[p]}
          </button>
        ))}
      </div>
      <select
        value={departamento}
        onChange={(e) => setDepartamento(e.target.value)}
        aria-label="Filtrar por departamento"
        className="campo w-auto py-1 text-xs"
      >
        <option value="">Todos los departamentos</option>
        {DEPARTAMENTOS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
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

  const { resumen: r, resumenPrevio: prev } = data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {filtros}
        <p className="text-xs text-suave">
          {data.rango.etiqueta}
          {departamento && ` · ${departamento}`} · comparado con el periodo anterior
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Ventas"
          valor={formatLps(r.ventas)}
          pie={`antes ${formatLps(prev.ventas)}`}
          delta={variacion(r.ventas, prev.ventas)}
        />
        <Tarjeta
          titulo="Pedidos"
          valor={String(r.pedidos)}
          pie={`antes ${prev.pedidos}`}
          delta={variacion(r.pedidos, prev.pedidos)}
        />
        <Tarjeta
          titulo="Ticket promedio"
          valor={formatLps(r.ticketPromedio)}
          pie={`antes ${formatLps(prev.ticketPromedio)}`}
          delta={variacion(r.ticketPromedio, prev.ticketPromedio)}
        />
        <Tarjeta
          titulo="Unidades"
          valor={String(r.unidades)}
          pie={`antes ${prev.unidades}`}
          delta={variacion(r.unidades, prev.unidades)}
        />
      </div>

      <div className="tarjeta min-w-0 p-6">
        <h2 className="text-lg">Ventas por día</h2>
        <div className="mt-4">
          <SerieDiaria serie={data.serie} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="tarjeta min-w-0 p-6">
          <h2 className="text-lg">Por departamento</h2>
          <BarrasZona
            filas={data.porDepartamento}
            vacio="Sin ventas por zona en este periodo."
          />
        </div>
        <div className="tarjeta min-w-0 p-6">
          <h2 className="text-lg">Municipios con más ventas</h2>
          <BarrasZona filas={data.porMunicipio} vacio="Sin ventas por municipio en este periodo." />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="tarjeta min-w-0 p-6">
          <h2 className="text-lg">Más vendidos</h2>
          {data.masVendidos.length === 0 ? (
            <p className="mt-4 text-sm text-suave">Todavía no hay ventas.</p>
          ) : (
            <ol className="mt-4 divide-y divide-borde">
              {data.masVendidos.map((p, i) => (
                <li key={p.productoId} className="flex min-w-0 items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="mr-2 text-suave">{i + 1}</span>
                    {p.nombre}
                  </span>
                  <span className="whitespace-nowrap text-suave">
                    {p.unidades} u. · {formatLps(p.ventas)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="tarjeta min-w-0 p-6">
          <h2 className="text-lg">Pedidos por estado</h2>
          {data.pedidosPorEstado.length === 0 ? (
            <p className="mt-4 text-sm text-suave">Sin pedidos en este periodo.</p>
          ) : (
            <ul className="mt-4 divide-y divide-borde">
              {data.pedidosPorEstado.map((e) => (
                <li key={e.estado} className="flex justify-between py-2 text-sm capitalize">
                  <span>{e.estado.replace(/_/g, ' ')}</span>
                  <span className="text-suave">{e.pedidos}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="tarjeta min-w-0 p-6">
          <h2 className="text-lg">Stock bajo</h2>
          {data.stockBajo.length === 0 ? (
            <p className="mt-4 text-sm text-suave">Ningún producto por debajo de 5 unidades.</p>
          ) : (
            <ul className="mt-4 divide-y divide-borde">
              {data.stockBajo.map((p) => (
                <li key={p.id} className="flex min-w-0 items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {p.nombre}
                    <span className="block text-[11px] text-suave">{p.categoria}</span>
                  </span>
                  <span className={p.stock === 0 ? 'text-acento' : 'text-suave'}>{p.stock}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
