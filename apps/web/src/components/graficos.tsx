/**
 * Gráficos hechos a mano con SVG. No se usa librería de charts a propósito:
 * cualquiera de las conocidas pesa más que todo el resto de la web junta, y
 * aquí solo hacen falta tres formas.
 */

/**
 * Paleta de la marca: tinta y vino con sus grises. La marca es blanca, así que
 * el color entra por los datos, no por el fondo.
 */
const PALETA = [
  '#111111',
  '#B03052',
  '#6B6B6B',
  '#C98B9B',
  '#3F3F3F',
  '#9A9A9A',
  '#E0C6CD',
  '#C4C4C4',
];

export const colorSerie = (i: number): string => PALETA[i % PALETA.length]!;

export interface Rebanada {
  etiqueta: string;
  valor: number;
}

/**
 * Dona con el total al centro.
 *
 * El radio es 15.9155 porque su circunferencia es exactamente 100: así cada
 * `strokeDasharray` se escribe directamente en porcentaje, sin convertir.
 */
export function Dona({
  datos,
  total,
  titulo,
  formato = (n) => String(n),
  centro,
}: {
  datos: Rebanada[];
  total: number;
  titulo: string;
  formato?: (n: number) => string;
  /** Texto del centro. Si se omite se abrevia el total. */
  centro?: string;
}) {
  // El centro de la dona es estrecho: un total largo se sale del círculo. Se
  // abrevia solo ahí; la leyenda de al lado lleva las cifras completas.
  const enElCentro =
    centro ?? (total >= 1000 ? `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)} K` : String(Math.round(total)));
  const suma = datos.reduce((t, d) => t + d.valor, 0);

  /*
    Sin datos se dibuja el aro vacío, no un texto.

    Una tienda que recién abre pasa días sin ventas, y un panel que en vez de
    gráficos enseña párrafos de "sin datos" parece roto. El aro gris comunica lo
    mismo —todavía no hay nada— sin que el tablero se desarme.
  */
  if (suma <= 0) {
    return (
      <div className="flex flex-wrap items-center gap-6">
        <svg viewBox="0 0 42 42" className="h-40 w-40 shrink-0" role="img" aria-label={titulo}>
          <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#EFEFEF" strokeWidth="5" />
          <text x="21" y="20.4" textAnchor="middle" className="fill-suave text-[4.6px] font-medium">
            {formato(0)}
          </text>
          <text x="21" y="25" textAnchor="middle" className="fill-suave text-[2.4px] uppercase">
            Total
          </text>
        </svg>
        <p className="min-w-0 flex-1 text-sm text-suave">
          Todavía no hay datos en este periodo. El gráfico se llena solo cuando entren ventas.
        </p>
      </div>
    );
  }

  let acumulado = 0;
  const segmentos = datos.map((d, i) => {
    const pct = (d.valor / suma) * 100;
    // -25 arranca el trazo arriba en vez de a la derecha.
    const seg = { d, pct, offset: -acumulado + 25, color: colorSerie(i) };
    acumulado += pct;
    return seg;
  });

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 42 42" className="h-40 w-40 shrink-0" role="img" aria-label={titulo}>
        {segmentos.map((s) => (
          <circle
            key={s.d.etiqueta}
            cx="21"
            cy="21"
            r="15.9155"
            fill="transparent"
            stroke={s.color}
            strokeWidth="5"
            strokeDasharray={`${s.pct} ${100 - s.pct}`}
            strokeDashoffset={s.offset}
          >
            <title>{`${s.d.etiqueta}: ${formato(s.d.valor)} (${Math.round(s.pct)}%)`}</title>
          </circle>
        ))}
        <text x="21" y="20.4" textAnchor="middle" className="fill-tinta text-[4.6px] font-medium">
          {enElCentro}
        </text>
        <text x="21" y="25" textAnchor="middle" className="fill-suave text-[2.4px] uppercase">
          Total
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {segmentos.map((s) => (
          <li key={s.d.etiqueta} className="flex min-w-0 items-baseline gap-2">
            <span
              aria-hidden
              className="mt-1 h-2.5 w-2.5 shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="min-w-0 flex-1 truncate">{s.d.etiqueta}</span>
            <span className="whitespace-nowrap text-suave">
              {formato(s.d.valor)} · {Math.round(s.pct)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Medidor de media luna con aguja. Sirve para un porcentaje con tres zonas:
 * rojo lo malo, ámbar lo regular, verde lo bueno.
 */
export function Medidor({
  porcentaje,
  etiqueta,
  titulo,
}: {
  porcentaje: number;
  etiqueta: string;
  titulo: string;
}) {
  const pct = Math.max(0, Math.min(100, porcentaje));
  // La media luna va de 180° a 360°; el 0% queda a la izquierda.
  const angulo = (180 + (pct / 100) * 180) * (Math.PI / 180);
  const punta = { x: 50 + Math.cos(angulo) * 30, y: 42 + Math.sin(angulo) * 30 };

  const arco = (desde: number, hasta: number, color: string) => {
    const p = (v: number) => {
      const a = (180 + (v / 100) * 180) * (Math.PI / 180);
      return `${50 + Math.cos(a) * 36} ${42 + Math.sin(a) * 36}`;
    };
    return (
      <path
        key={color}
        d={`M ${p(desde)} A 36 36 0 0 1 ${p(hasta)}`}
        fill="none"
        stroke={color}
        strokeWidth="9"
      />
    );
  };

  return (
    <div>
      <svg viewBox="0 0 100 52" className="w-full max-w-xs" role="img" aria-label={titulo}>
        {arco(0, 50, '#C0392B')}
        {arco(50, 80, '#D9A441')}
        {arco(80, 100, '#3F6C51')}
        <line
          x1="50"
          y1="42"
          x2={punta.x}
          y2={punta.y}
          stroke="#111111"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="50" cy="42" r="2.6" fill="#111111" />
      </svg>
      <p className="mt-1 font-display text-2xl">{Math.round(pct)}%</p>
      <p className="text-xs text-suave">{etiqueta}</p>
    </div>
  );
}

/** Barra horizontal apilada: la composición de una fila en una sola línea. */
export function BarraApilada({
  nombre,
  partes,
  pie,
}: {
  nombre: string;
  partes: Array<{ etiqueta: string; valor: number; color: string }>;
  pie?: string;
}) {
  const suma = partes.reduce((t, p) => t + p.valor, 0) || 1;
  return (
    <li className="min-w-0">
      <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{nombre}</span>
        {pie && <span className="whitespace-nowrap text-suave">{pie}</span>}
      </div>
      <div className="mt-1 flex h-3 w-full overflow-hidden bg-fondo">
        {partes.map((p) => (
          <div
            key={p.etiqueta}
            style={{ width: `${(p.valor / suma) * 100}%`, backgroundColor: p.color }}
            title={`${p.etiqueta}: ${p.valor}`}
          />
        ))}
      </div>
    </li>
  );
}
