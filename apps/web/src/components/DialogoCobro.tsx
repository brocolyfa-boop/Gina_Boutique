import { useEffect, useRef, useState } from 'react';
import type { OrdenDTO } from '@gina/shared';
import { enlaceWhatsApp, formatLps, mensajeCobroWhatsApp } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso } from './ui';

/**
 * Enlace de cobro de un pedido.
 *
 * No es una pasarela: la tienda no cobra ni se entera de si el cliente pagó.
 * El enlace lo genera la dueña en su banca por el monto exacto, se pega aquí y
 * el botón se lo manda al cliente por WhatsApp. Cuando el dinero entra, el
 * estado del pedido se cambia a mano en la tabla.
 *
 * Se resolvió así y no con una pasarela porque funciona con cualquier banco,
 * hoy, sin contrato ni comisión. La pasarela sigue siendo el paso siguiente.
 */
export default function DialogoCobro({
  orden,
  onCerrar,
  onGuardado,
}: {
  orden: OrdenDTO | null;
  onCerrar: () => void;
  onGuardado: () => Promise<void> | void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (orden) {
      setEnlace(orden.enlacePago ?? '');
      setError(null);
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [orden]);

  if (!orden) return <dialog ref={dialogo} className="hidden" />;

  const guardar = async (valor: string) => {
    setError(null);
    setGuardando(true);
    try {
      await api<OrdenDTO>(`/ordenes/${orden.id}/pago`, {
        method: 'PATCH',
        body: { enlacePago: valor },
      });
      await onGuardado();
      onCerrar();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo guardar el enlace');
    } finally {
      setGuardando(false);
    }
  };

  // El botón de enviar usa el enlace ya guardado, no lo que hay escrito: mandar
  // uno sin guardar dejaría al cliente con un enlace que el panel no recuerda.
  const enviar = orden.enlacePago
    ? enlaceWhatsApp(orden.telefonoContacto, mensajeCobroWhatsApp(orden, orden.enlacePago))
    : null;

  return (
    <dialog
      ref={dialogo}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === dialogo.current) onCerrar();
      }}
      className="w-[min(32rem,92vw)] border border-borde bg-white p-0 shadow-marco backdrop:bg-black/40"
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar(enlace.trim());
        }}
        className="p-6 md:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl">Enlace de cobro</h2>
            <p className="mt-1 text-sm text-suave">
              Pedido {orden.numero} · {orden.nombreCliente}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="text-lg leading-none text-suave hover:text-tinta"
          >
            ✕
          </button>
        </div>

        <p className="mt-5 border border-borde bg-fondo px-4 py-3 text-sm">
          Total a cobrar: <strong>{formatLps(orden.total)}</strong>
          <span className="block text-xs text-suave">
            Genera el enlace en tu banca por este monto exacto y pégalo abajo.
          </span>
        </p>

        {error && (
          <div className="mt-4">
            <Aviso>{error}</Aviso>
          </div>
        )}

        <label className="mt-5 block">
          <span className="etiqueta">Enlace del banco</span>
          <input
            type="url"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://…"
            className="campo mt-2"
          />
          <span className="mt-1 block text-xs text-suave">
            Debe empezar con https. Déjalo vacío para quitar el enlace.
          </span>
        </label>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-borde pt-5">
          <button type="submit" disabled={guardando} className="btn-principal">
            {guardando ? 'Guardando…' : 'Guardar enlace'}
          </button>
          {enviar && (
            <a href={enviar} target="_blank" rel="noreferrer" className="btn-secundario">
              Enviar por WhatsApp
            </a>
          )}
          <button type="button" onClick={onCerrar} className="btn-secundario">
            Cerrar
          </button>
        </div>

        <p className="mt-5 text-xs leading-relaxed text-suave">
          La tienda no se entera de si el cliente pagó. Cuando veas el dinero en tu cuenta, cambia
          el estado del pedido a <strong>pagado</strong> en la tabla.
        </p>
      </form>
    </dialog>
  );
}
