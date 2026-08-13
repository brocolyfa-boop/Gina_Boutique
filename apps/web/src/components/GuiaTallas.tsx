import { useEffect, useRef } from 'react';
import type { MedidasPrenda } from '@gina/shared';
import { TABLA_TALLAS_MUJER } from '@gina/shared';

/**
 * Guía de tallas de la ficha de producto.
 *
 * En ropa vendida por internet, la duda de la talla es lo que más carritos
 * abandona: quien no sabe si le queda, no compra, y quien compra a ciegas
 * devuelve. Enseñar la tabla junto al selector cuesta muy poco y evita las dos
 * cosas.
 *
 * Se usa `<dialog>` del navegador en vez de un modal a mano: trae gratis el
 * cierre con Escape, el foco atrapado dentro y el fondo inerte, que son
 * justamente las tres cosas que los modales caseros olvidan.
 */

const ETIQUETA_MEDIDA: Record<keyof MedidasPrenda, string> = {
  pecho: 'Pecho',
  cintura: 'Cintura',
  cadera: 'Cadera',
  largo: 'Largo',
  manga: 'Manga',
  tiro: 'Tiro',
};

export default function GuiaTallas({
  abierta,
  onCerrar,
  medidas,
  nombreProducto,
}: {
  abierta: boolean;
  onCerrar: () => void;
  medidas: MedidasPrenda | null;
  nombreProducto: string;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  const propias = Object.entries(medidas ?? {}).filter(
    (entrada): entrada is [keyof MedidasPrenda, number] => typeof entrada[1] === 'number',
  );

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      // El clic en el fondo cierra: el <dialog> es el propio fondo, así que se
      // compara el objetivo del clic con el elemento.
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      className="w-[min(34rem,92vw)] border border-borde bg-white p-0 shadow-marco backdrop:bg-black/40"
    >
      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl">Guía de tallas</h2>
          <button
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-lg leading-none text-suave hover:text-tinta"
          >
            ✕
          </button>
        </div>

        <p className="mt-2 text-sm text-suave">
          Medidas del cuerpo en centímetros. Si estás entre dos tallas, elige la mayor.
        </p>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left">
                <th className="py-2 font-normal text-suave">Talla</th>
                <th className="py-2 font-normal text-suave">Busto</th>
                <th className="py-2 font-normal text-suave">Cintura</th>
                <th className="py-2 font-normal text-suave">Cadera</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {TABLA_TALLAS_MUJER.map((t) => (
                <tr key={t.talla}>
                  <td className="py-2 font-medium">{t.talla}</td>
                  <td className="py-2 text-suave">{t.busto}</td>
                  <td className="py-2 text-suave">{t.cintura}</td>
                  <td className="py-2 text-suave">{t.cadera}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {propias.length > 0 && (
          <div className="mt-6 border-t border-borde pt-5">
            <h3 className="text-sm font-medium">Medidas de esta prenda</h3>
            <p className="mt-1 text-xs text-suave">{nombreProducto}, en centímetros.</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {propias.map(([clave, valor]) => (
                <div key={clave} className="flex justify-between gap-2">
                  <dt className="text-suave">{ETIQUETA_MEDIDA[clave]}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <p className="mt-6 border-t border-borde pt-5 text-xs leading-relaxed text-suave">
          ¿No te queda? Tienes 7 días para cambiarla de talla, sin usar y con etiqueta. Mira los
          detalles en{' '}
          <a href="/politicas/cambios-y-devoluciones" className="text-tinta underline">
            cambios y devoluciones
          </a>
          .
        </p>
      </div>
    </dialog>
  );
}
