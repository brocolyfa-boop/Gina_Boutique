import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoriaDTO } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso, Skeleton } from './ui';
import CampoImagen from './CampoImagen';

/** "Ropa de Niños" → "ropa-de-ninos". El backend solo admite [a-z0-9-]. */
function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * El servidor devuelve el detalle por campo; sin esto el formulario solo diría
 * "revisa los datos" y el supervisor no sabría cuál corregir.
 */
function mensajeDe(e: unknown, porDefecto: string): string {
  if (!(e instanceof ApiError)) return porDefecto;
  const detalles = Object.values(e.detalles ?? {}).flat();
  return detalles.length > 0 ? detalles.join('. ') : e.message;
}

interface Borrador {
  nombre: string;
  slug: string;
  imagen: string;
  orden: string;
  subcategorias: string;
}

const VACIO: Borrador = { nombre: '', slug: '', imagen: '', orden: '0', subcategorias: '' };

const desde = (c: CategoriaDTO): Borrador => ({
  nombre: c.nombre,
  slug: c.slug,
  imagen: c.imagen ?? '',
  orden: String(c.orden),
  subcategorias: c.subcategorias.join(', '),
});

export default function AdminCategorias() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<CategoriaDTO | 'nueva' | null>(null);
  const [b, setB] = useState<Borrador>(VACIO);
  const [error, setError] = useState<string | null>(null);
  // El slug deja de seguir al nombre en cuanto se toca a mano: cambiarlo en una
  // categoría ya publicada rompe los enlaces que el cliente tenga guardados.
  const [slugManual, setSlugManual] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
  });

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: ['categorias'] });
    await qc.invalidateQueries({ queryKey: ['productos'] });
  };

  const abrir = (c: CategoriaDTO | 'nueva') => {
    setError(null);
    setSlugManual(c !== 'nueva');
    setB(c === 'nueva' ? VACIO : desde(c));
    setEditando(c);
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre: b.nombre.trim(),
        slug: b.slug.trim(),
        imagen: b.imagen.trim() || null,
        orden: Number(b.orden) || 0,
        subcategorias: b.subcategorias
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editando === 'nueva') return api<CategoriaDTO>('/categorias', { method: 'POST', body: payload });
      if (editando) return api<CategoriaDTO>(`/categorias/${editando.id}`, { method: 'PATCH', body: payload });
    },
    onSuccess: async () => {
      await refrescar();
      setEditando(null);
    },
    onError: (e) => setError(mensajeDe(e, 'No se pudo guardar')),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => api<void>(`/categorias/${id}`, { method: 'DELETE' }),
    onSuccess: refrescar,
    onError: (e) =>
      setError(
        `${mensajeDe(e, 'No se pudo eliminar')}. Si tiene productos, muévelos a otra categoría primero.`,
      ),
  });

  if (editando) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
        className="tarjeta max-w-2xl space-y-5 p-6"
      >
        <h2 className="text-xl">{editando === 'nueva' ? 'Nueva categoría' : editando.nombre}</h2>
        {error && <Aviso>{error}</Aviso>}

        <label className="block">
          <span className="etiqueta">Nombre</span>
          <input
            required
            value={b.nombre}
            onChange={(e) => {
              const nombre = e.target.value;
              setB((x) => ({ ...x, nombre, slug: slugManual ? x.slug : aSlug(nombre) }));
            }}
            className="campo mt-1"
            placeholder="Vestidos"
          />
        </label>

        <label className="block">
          <span className="etiqueta">Dirección web (slug)</span>
          <input
            required
            value={b.slug}
            onChange={(e) => {
              setSlugManual(true);
              setB((x) => ({ ...x, slug: aSlug(e.target.value) }));
            }}
            className="campo mt-1"
            placeholder="vestidos"
          />
          <span className="mt-1 block text-xs text-suave">/catalogo?categoria={b.slug || '…'}</span>
        </label>

        <label className="block">
          <span className="etiqueta">Subcategorías</span>
          <input
            value={b.subcategorias}
            onChange={(e) => setB((x) => ({ ...x, subcategorias: e.target.value }))}
            className="campo mt-1"
            placeholder="Casual, Formal, Fiesta"
          />
          <span className="mt-1 block text-xs text-suave">Sepáralas con comas.</span>
        </label>

        <label className="block">
          <span className="etiqueta">Orden en el menú</span>
          <input
            type="number"
            min={0}
            value={b.orden}
            onChange={(e) => setB((x) => ({ ...x, orden: e.target.value }))}
            className="campo mt-1 w-32"
          />
          <span className="mt-1 block text-xs text-suave">Menor número, más a la izquierda.</span>
        </label>

        <CampoImagen
          valor={b.imagen}
          onCambio={(url) => setB((x) => ({ ...x, imagen: url }))}
          carpeta="categorias"
          etiqueta="Foto de la categoría"
        />

        <div className="flex gap-3 border-t border-borde pt-5">
          <button type="submit" disabled={guardar.isPending} className="btn-principal">
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setEditando(null)} className="btn-secundario">
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-suave">{data?.length ?? 0} categorías</p>
        <button onClick={() => abrir('nueva')} className="btn-principal">
          Nueva categoría
        </button>
      </div>

      {error && <div className="mt-4 max-w-2xl">
        <Aviso>{error}</Aviso>
      </div>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead>
            <tr className="border-b border-borde text-left">
              <th className="py-3 font-normal text-suave">Categoría</th>
              <th className="py-3 font-normal text-suave">Subcategorías</th>
              <th className="py-3 font-normal text-suave">Productos</th>
              <th className="py-3 font-normal text-suave">Orden</th>
              <th className="py-3 font-normal text-suave"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-borde">
            {data?.map((c) => (
              <tr key={c.id}>
                <td className="flex items-center gap-3 py-3">
                  {c.imagen ? (
                    <img src={c.imagen} alt="" loading="lazy" className="h-12 w-12 object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center bg-fondo text-[10px] text-suave">
                      sin foto
                    </span>
                  )}
                  <span>
                    {c.nombre}
                    <span className="block text-xs text-suave">/{c.slug}</span>
                  </span>
                </td>
                <td className="py-3 text-suave">{c.subcategorias.join(', ') || '—'}</td>
                <td className="py-3">{c.totalProductos ?? 0}</td>
                <td className="py-3 text-suave">{c.orden}</td>
                <td className="space-x-4 py-3 text-right">
                  <button
                    onClick={() => abrir(c)}
                    className="text-xs uppercase tracking-etiqueta hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      if (confirm(`¿Eliminar la categoría "${c.nombre}"?`)) borrar.mutate(c.id);
                    }}
                    className="text-xs uppercase tracking-etiqueta text-acento hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
