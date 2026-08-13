import type { EstadoOrden } from '@gina/shared';

/**
 * Barra de progreso del pedido, al estilo de las tiendas grandes.
 *
 * Un cliente que compró y no sabe nada más escribe por WhatsApp a preguntar, o
 * peor, asume que lo estafaron. Ver en qué paso va su pedido evita las dos
 * cosas, y le ahorra a la tienda contestar lo mismo diez veces al día.
 */

const PASOS = [
  { estado: 'pendiente', titulo: 'Recibido', detalle: 'Tenemos tu pedido' },
  { estado: 'pagado', titulo: 'Pagado', detalle: 'Confirmamos tu pago' },
  { estado: 'enviado', titulo: 'En camino', detalle: 'Va hacia tu dirección' },
  { estado: 'entregado', titulo: 'Entregado', detalle: 'Llegó a tus manos' },
] as const;

export default function EstadoPedido({
  estado,
  entregaEstimadaDias,
}: {
  estado: EstadoOrden;
  /** Se muestra solo mientras el pedido sigue en curso. */
  entregaEstimadaDias?: { min: number; max: number };
}) {
  /*
    Cancelado no es un paso más de la fila: es una salida del camino. Pintarlo
    como cuarta casilla haría creer que el pedido sigue avanzando.
  */
  if (estado === 'cancelado') {
    return (
      <div className="border border-acento/30 bg-acento/5 px-4 py-3">
        <p className="text-sm text-acento">Pedido cancelado</p>
        <p className="mt-1 text-xs text-suave">
          Si fue un error, escríbenos por WhatsApp y lo reactivamos.
        </p>
      </div>
    );
  }

  const actual = PASOS.findIndex((p) => p.estado === estado);
  // Un estado que no reconozcamos no debe dejar la barra en blanco.
  const indice = actual < 0 ? 0 : actual;
  const ultimo = PASOS.length - 1;

  return (
    <div>
      <ol className="flex items-start">
        {PASOS.map((paso, i) => {
          const hecho = i <= indice;
          const esActual = i === indice;
          return (
            <li key={paso.estado} className="flex min-w-0 flex-1 flex-col items-center">
              {/* Los tramos de línea van dentro de cada paso para que el punto
                  quede siempre centrado sobre su etiqueta, a cualquier ancho. */}
              <div className="flex w-full items-center" aria-hidden>
                <span className={`h-px flex-1 ${i === 0 ? 'bg-transparent' : i <= indice ? 'bg-tinta' : 'bg-borde'}`} />
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    hecho
                      ? 'border-tinta bg-tinta text-white'
                      : 'border-borde bg-white text-suave'
                  }`}
                >
                  {hecho ? '✓' : i + 1}
                </span>
                <span
                  className={`h-px flex-1 ${i === ultimo ? 'bg-transparent' : i < indice ? 'bg-tinta' : 'bg-borde'}`}
                />
              </div>
              <p
                className={`mt-2 px-1 text-center text-[11px] leading-tight ${
                  esActual ? 'font-medium text-tinta' : hecho ? 'text-tinta' : 'text-suave'
                }`}
              >
                {paso.titulo}
              </p>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-center text-xs text-suave">
        {PASOS[indice]?.detalle}
        {entregaEstimadaDias && indice < ultimo && (
          <> · Entrega estimada: {entregaEstimadaDias.min} a {entregaEstimadaDias.max} días</>
        )}
      </p>
    </div>
  );
}
