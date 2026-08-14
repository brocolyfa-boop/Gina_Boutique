import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Rol } from '@gina/shared';
import { formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { Skeleton } from './ui';
import RecuperacionesPendientes from './RecuperacionesPendientes';

interface ClienteFila {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  createdAt: string;
  pedidos: number;
  gastado: number;
}

export default function AdminClientes() {
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

  // Espera de 300 ms: no se consulta la base con cada tecla.
  useEffect(() => {
    const id = setTimeout(() => setBusqueda(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'clientes', busqueda],
    queryFn: () =>
      api<ClienteFila[]>(`/usuarios/admin${busqueda ? `?q=${encodeURIComponent(busqueda)}` : ''}`),
  });

  return (
    <div>
      {/* Arriba del todo: es lo único de esta pantalla que tiene a alguien
          esperando del otro lado. */}
      <RecuperacionesPendientes />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nombre o correo"
          aria-label="Buscar cliente"
          className="campo max-w-sm py-2"
        />
        <p className="text-sm text-suave">
          {data?.length ?? 0} {data?.length === 1 ? 'cuenta' : 'cuentas'}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="mt-8 text-sm text-suave">No hay cuentas que coincidan.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left">
                <th className="py-3 font-normal text-suave">Cliente</th>
                <th className="py-3 font-normal text-suave">Teléfono</th>
                <th className="py-3 font-normal text-suave">Registro</th>
                <th className="py-3 font-normal text-suave">Pedidos</th>
                <th className="py-3 font-normal text-suave">Comprado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.map((c) => (
                <tr key={c.id}>
                  <td className="py-3">
                    <span className="flex flex-wrap items-center gap-2">
                      {c.nombre}
                      {c.rol === 'admin' && (
                        <span className="border border-borde px-2 py-0.5 text-[11px] text-suave">
                          admin
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-suave">{c.email}</span>
                  </td>
                  <td className="py-3 text-suave">{c.telefono ?? '—'}</td>
                  <td className="py-3 text-suave">
                    {new Date(c.createdAt).toLocaleDateString('es-HN')}
                  </td>
                  <td className="py-3">{c.pedidos}</td>
                  <td className="py-3">{formatLps(c.gastado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
