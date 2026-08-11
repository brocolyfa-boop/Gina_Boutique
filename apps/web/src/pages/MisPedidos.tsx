import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EstadoOrden, OrdenDTO } from '@gina/shared';
import { formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { Skeleton, Vacio } from '../components/ui';
import { useTitulo } from '../lib/titulo';

const COLOR_ESTADO: Record<EstadoOrden, string> = {
  pendiente: 'bg-fondo text-suave',
  pagado: 'bg-tinta text-white',
  enviado: 'bg-tinta text-white',
  entregado: 'bg-tinta text-white',
  cancelado: 'bg-acento/10 text-acento',
};

export default function MisPedidos() {
  useTitulo('Mis pedidos');

  const { user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['mis-ordenes'],
    queryFn: () => api<OrdenDTO[]>('/ordenes'),
    enabled: !!user,
  });

  const cancelar = useMutation({
    mutationFn: (id: string) => api<OrdenDTO>(`/ordenes/${id}/cancelar`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['mis-ordenes'] }),
  });

  if (!user) {
    return (
      <Vacio
        titulo="Inicia sesión"
        texto="Necesitas tu cuenta para ver el historial de pedidos."
        accion={
          <Link to="/entrar?volver=/mis-pedidos" className="btn-principal">
            Entrar
          </Link>
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Vacio
        titulo="Todavía no tienes pedidos"
        texto="Cuando compres algo lo verás aquí, con su estado y el tiempo de entrega."
        accion={
          <Link to="/catalogo" className="btn-principal">
            Ver catálogo
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl">Mis pedidos</h1>

      <ul className="mt-8 space-y-6">
        {data.map((o) => (
          <li key={o.id} className="tarjeta p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg">{o.numero}</p>
                <p className="mt-1 text-xs text-suave">
                  {new Date(o.createdAt).toLocaleDateString('es-HN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <span
                className={`px-3 py-1 text-[10px] uppercase tracking-etiqueta ${COLOR_ESTADO[o.estado]}`}
              >
                {o.estado}
              </span>
            </div>

            <ul className="mt-5 divide-y divide-borde border-y border-borde">
              {o.items.map((i, idx) => (
                <li key={idx} className="flex items-center gap-3 py-3">
                  {i.imagen && <img src={i.imagen} alt="" loading="lazy" className="h-16 w-12 object-cover" />}
                  <div className="flex-1 text-sm">
                    <p>{i.nombre}</p>
                    <p className="text-xs text-suave">
                      {[i.talla && `Talla ${i.talla}`, i.color, `Cantidad ${i.cantidad}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <p className="text-sm">{formatLps(i.precioUnitario * i.cantidad)}</p>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4 text-sm">
              <div className="text-xs text-suave">
                <p>
                  Envío a {o.municipio}, {o.departamento}
                </p>
                <p className="mt-1">
                  Entrega estimada: {o.entregaEstimadaDias.min} a {o.entregaEstimadaDias.max} días
                </p>
                <p className="mt-1">
                  Pago: {o.metodoPago === 'contra_entrega' ? 'contra entrega' : 'tarjeta'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-suave">Total</p>
                <p className="text-lg font-medium">{formatLps(o.total)}</p>
              </div>
            </div>

            {o.estado === 'pendiente' && (
              <button
                onClick={() => cancelar.mutate(o.id)}
                disabled={cancelar.isPending}
                className="mt-4 text-xs uppercase tracking-etiqueta text-suave hover:text-acento"
              >
                {cancelar.isPending ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
