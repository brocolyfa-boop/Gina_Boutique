import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { enlaceWhatsApp } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso } from './ui';

/**
 * Clientes que pidieron recuperar su contraseña y esperan el código.
 *
 * Existe porque sin credenciales de Meta el código no sale solo. Antes de esto
 * la única forma de rescatarlo era leer los registros del servidor desde una
 * terminal, algo que la dueña de la tienda no va a hacer: en la práctica, el
 * cliente se quedaba sin cuenta.
 *
 * El panel no muestra códigos guardados —en la base van hasheados—: al apretar
 * el botón se genera uno nuevo, se entrega una sola vez y se abre WhatsApp con
 * el mensaje ya escrito.
 */

interface Pendiente {
  id: string;
  telefono: string | null;
  nombre: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' });

export default function RecuperacionesPendientes() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin', 'recuperaciones'],
    queryFn: () => api<Pendiente[]>('/usuarios/admin/recuperaciones'),
    // Llegan mientras la pantalla está abierta; sin esto habría que recargar.
    refetchInterval: 30_000,
  });

  const generar = useMutation({
    mutationFn: (id: string) =>
      api<{ telefono: string; mensaje: string }>(`/usuarios/admin/recuperaciones/${id}/codigo`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      setError(null);
      const url = enlaceWhatsApp(res.telefono, res.mensaje);
      // Se abre en otra pestaña para no sacar a la dueña del panel.
      if (url) window.open(url, '_blank', 'noopener');
      void qc.invalidateQueries({ queryKey: ['admin', 'recuperaciones'] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo generar el código'),
  });

  // Sin solicitudes no se ocupa espacio en la pantalla.
  if (!data || data.length === 0) return null;

  return (
    <section className="mb-8 border border-borde bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base">
          Contraseñas por recuperar
          <span className="ml-2 bg-tinta px-2 py-0.5 text-[11px] text-white">{data.length}</span>
        </h2>
        <span className="text-xs text-suave">Se actualiza solo</span>
      </div>

      <p className="mt-2 text-xs text-suave">
        Estos clientes no pueden entrar a su cuenta. Al mandar el código se abre WhatsApp con el
        mensaje listo.
      </p>

      {error && (
        <div className="mt-3">
          <Aviso>{error}</Aviso>
        </div>
      )}

      <ul className="mt-4 divide-y divide-borde">
        {data.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.nombre}</p>
              <p className="mt-0.5 text-xs text-suave">
                {p.telefono} · pidió a las {hora(p.createdAt)}
              </p>
            </div>
            <button
              onClick={() => generar.mutate(p.id)}
              disabled={generar.isPending}
              className="btn-principal shrink-0 px-4 py-2 text-xs"
            >
              {generar.isPending ? 'Generando…' : 'Mandar código'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
