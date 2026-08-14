import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ConfigPublicaDTO } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Aviso } from './ui';

/**
 * Botón "Entrar con Google".
 *
 * Lo dibuja Google, no nosotros: su script devuelve un botón oficial con el
 * logo y los textos correctos. Imitarlo a mano incumple sus normas de marca y
 * además hay que mantenerlo cuando ellos lo cambien.
 *
 * El script se carga solo si hay Client ID configurado. Sin él, este componente
 * no pinta nada y la tienda sigue funcionando con correo y contraseña: una
 * variable de entorno sin poner no puede dejar a nadie fuera de su cuenta.
 */

interface Google {
  accounts: {
    id: {
      initialize(opciones: { client_id: string; callback: (r: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, opciones: Record<string, unknown>): void;
    };
  };
}
declare global {
  interface Window {
    google?: Google;
  }
}

const SCRIPT = 'https://accounts.google.com/gsi/client';

/** Se carga una sola vez aunque el componente se monte y desmonte. */
function cargarScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  if (existente) {
    return new Promise((ok, err) => {
      existente.addEventListener('load', () => ok());
      existente.addEventListener('error', () => err(new Error('no cargó')));
    });
  }
  return new Promise((ok, err) => {
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => err(new Error('no cargó'));
    document.head.appendChild(s);
  });
}

export default function BotonGoogle({ alEntrar }: { alEntrar: () => void }) {
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  /*
    El separador "o" solo se dibuja cuando el botón llegó a montarse. Si el
    script de Google no carga —red bloqueada, un bloqueador de anuncios— la
    pantalla quedaba con una "o" suelta y nada debajo.
  */
  const [montado, setMontado] = useState(false);
  const { entrarConGoogle } = useAuth();

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ConfigPublicaDTO>('/config'),
  });
  const clientId = config?.googleClientId;

  useEffect(() => {
    if (!clientId || !caja.current) return;
    let vivo = true;

    void cargarScript()
      .then(() => {
        if (!vivo || !caja.current || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async ({ credential }) => {
            setError(null);
            try {
              await entrarConGoogle(credential);
              alEntrar();
            } catch (e) {
              setError(
                e instanceof ApiError ? e.message : 'No pudimos entrar con Google. Intenta de nuevo.',
              );
            }
          },
        });

        window.google.accounts.id.renderButton(caja.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          locale: 'es',
          width: 320,
        });
        setMontado(true);
      })
      .catch(() => {
        // Sin internet hacia Google el botón no aparece; el formulario de
        // siempre sigue ahí, así que no se avisa de nada.
      });

    return () => {
      vivo = false;
    };
  }, [clientId, alEntrar, entrarConGoogle]);

  if (!clientId) return null;

  return (
    <div className="space-y-3">
      {montado && (
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-borde" />
          <span className="text-xs uppercase tracking-etiqueta text-suave">o</span>
          <span className="h-px flex-1 bg-borde" />
        </div>
      )}
      {/* Google exige que su botón viva en un contenedor propio. */}
      <div ref={caja} className="flex justify-center" />
      {error && <Aviso>{error}</Aviso>}
    </div>
  );
}
