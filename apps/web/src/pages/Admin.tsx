import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoriaDTO, EstadoOrden, OrdenDTO, Paginado, ProductoDTO } from '@gina/shared';
import { ESTADOS_ORDEN, formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import { Skeleton, Vacio } from '../components/ui';
import FormularioProducto from '../components/FormularioProducto';
import PanelVentas from '../components/PanelVentas';

function Pedidos() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<EstadoOrden | ''>('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ordenes', filtro],
    queryFn: () => api<OrdenDTO[]>(`/ordenes/admin/todas${filtro ? `?estado=${filtro}` : ''}`),
  });

  const cambiar = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoOrden }) =>
      api<OrdenDTO>(`/ordenes/${id}/estado`, { method: 'PATCH', body: { estado } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {['', ...ESTADOS_ORDEN].map((e) => (
          <button
            key={e || 'todos'}
            onClick={() => setFiltro(e as EstadoOrden | '')}
            className={`border px-3 py-1 text-xs uppercase tracking-etiqueta transition ${
              filtro === e ? 'border-tinta bg-tinta text-white' : 'border-borde hover:border-tinta'
            }`}
          >
            {e || 'Todos'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="mt-8 text-sm text-suave">No hay pedidos con ese estado.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left">
                <th className="py-3 font-normal text-suave">Pedido</th>
                <th className="py-3 font-normal text-suave">Fecha</th>
                <th className="py-3 font-normal text-suave">Envío a</th>
                <th className="py-3 font-normal text-suave">Total</th>
                <th className="py-3 font-normal text-suave">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data.map((o) => (
                <tr key={o.id}>
                  <td className="py-3">
                    <span className="font-medium">{o.numero}</span>
                    <span className="block text-xs text-suave">
                      {o.items.length} {o.items.length === 1 ? 'artículo' : 'artículos'} ·{' '}
                      {o.telefonoContacto}
                    </span>
                  </td>
                  <td className="py-3 text-suave">
                    {new Date(o.createdAt).toLocaleDateString('es-HN')}
                  </td>
                  <td className="py-3 text-suave">
                    {o.municipio}, {o.departamento}
                  </td>
                  <td className="py-3">{formatLps(o.total)}</td>
                  <td className="py-3">
                    <select
                      value={o.estado}
                      onChange={(e) =>
                        cambiar.mutate({ id: o.id, estado: e.target.value as EstadoOrden })
                      }
                      className="campo w-auto py-1 text-xs"
                    >
                      {ESTADOS_ORDEN.map((e) => (
                        <option key={e} value={e}>
                          {e}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Productos() {
  const qc = useQueryClient();
  // null = no se está editando nada; 'nuevo' = alta; un producto = edición.
  const [editando, setEditando] = useState<ProductoDTO | 'nuevo' | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'productos'],
    queryFn: () => api<Paginado<ProductoDTO>>('/productos/admin/todos?limit=60'),
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
  });

  const alternar = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api<ProductoDTO>(`/productos/${id}`, { method: 'PATCH', body: { activo } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'productos'] }),
  });

  const guardar = async (payload: unknown) => {
    if (editando === 'nuevo') {
      await api<ProductoDTO>('/productos', { method: 'POST', body: payload });
    } else if (editando) {
      await api<ProductoDTO>(`/productos/${editando.id}`, { method: 'PATCH', body: payload });
    }
    // Se invalida también el catálogo público: si no, la tienda seguiría
    // mostrando el producto viejo hasta que caduque su caché.
    await qc.invalidateQueries({ queryKey: ['admin', 'productos'] });
    await qc.invalidateQueries({ queryKey: ['productos'] });
    setEditando(null);
  };

  if (editando) {
    if (!categorias?.length) return <Skeleton className="h-40 w-full" />;
    return (
      <FormularioProducto
        producto={editando === 'nuevo' ? null : editando}
        categorias={categorias}
        onGuardar={guardar}
        onCancelar={() => setEditando(null)}
      />
    );
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-suave">
          {data?.total ?? 0} {data?.total === 1 ? 'producto' : 'productos'}
        </p>
        <button onClick={() => setEditando('nuevo')} className="btn-principal">
          Nuevo producto
        </button>
      </div>

      {data && data.data.length === 0 ? (
        <p className="mt-8 text-sm text-suave">
          Todavía no hay productos. Crea el primero con el botón de arriba.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left">
                <th className="py-3 font-normal text-suave">Producto</th>
                <th className="py-3 font-normal text-suave">Categoría</th>
                <th className="py-3 font-normal text-suave">Precio</th>
                <th className="py-3 font-normal text-suave">Stock</th>
                <th className="py-3 font-normal text-suave">Estado</th>
                <th className="py-3 font-normal text-suave"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data?.data.map((p) => (
                <tr key={p.id}>
                  <td className="flex items-center gap-3 py-3">
                    {p.imagenes[0] ? (
                      <img src={p.imagenes[0]} alt="" loading="lazy" className="h-14 w-11 object-cover" />
                    ) : (
                      <span className="flex h-14 w-11 items-center justify-center bg-fondo text-[10px] text-suave">
                        sin foto
                      </span>
                    )}
                    <span>
                      <Link to={`/producto/${p.id}`} className="hover:underline">
                        {p.nombre}
                      </Link>
                      {p.sku && <span className="block text-xs text-suave">{p.sku}</span>}
                    </span>
                  </td>
                  <td className="py-3 text-suave">{p.categoria.nombre}</td>
                  <td className="py-3">
                    {formatLps(p.precioFinal)}
                    {p.descuentoPorcentaje != null && (
                      <span className="block text-xs text-suave line-through">{formatLps(p.precio)}</span>
                    )}
                  </td>
                  <td className={`py-3 ${p.stock === 0 ? 'text-acento' : ''}`}>{p.stock}</td>
                  <td className="py-3">
                    <button
                      onClick={() => alternar.mutate({ id: p.id, activo: !p.activo })}
                      className="text-xs uppercase tracking-etiqueta hover:underline"
                    >
                      {p.activo ? 'Activo' : 'Oculto'}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => setEditando(p)}
                      className="text-xs uppercase tracking-etiqueta hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const PESTANAS = [
  { clave: 'dashboard', texto: 'Ventas y zonas' },
  { clave: 'pedidos', texto: 'Pedidos' },
  { clave: 'productos', texto: 'Productos' },
] as const;

export default function Admin() {
  const { esAdmin, cargando } = useAuth();
  const [pestana, setPestana] = useState<(typeof PESTANAS)[number]['clave']>('dashboard');

  if (cargando) return <Skeleton className="mx-auto mt-16 h-40 max-w-3xl" />;

  if (!esAdmin) {
    return (
      <Vacio
        titulo="Área restringida"
        texto="Esta sección es solo para el equipo de la tienda."
        accion={
          <Link to="/" className="btn-principal">
            Volver al inicio
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl">Administración</h1>

      <nav className="mt-6 flex gap-6 border-b border-borde">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            onClick={() => setPestana(p.clave)}
            className={`-mb-px border-b-2 pb-3 text-xs uppercase tracking-etiqueta transition ${
              pestana === p.clave ? 'border-tinta text-tinta' : 'border-transparent text-suave'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </nav>

      <div className="mt-8">
        {pestana === 'dashboard' && <PanelVentas />}
        {pestana === 'pedidos' && <Pedidos />}
        {pestana === 'productos' && <Productos />}
      </div>
    </div>
  );
}
