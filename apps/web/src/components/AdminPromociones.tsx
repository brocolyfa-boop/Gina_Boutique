import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoriaDTO, PromocionDTO, TipoPromocion } from '@gina/shared';
import { TIPOS_PROMOCION, formatLps } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso, Skeleton } from './ui';
import CampoImagen from './CampoImagen';

/** `datetime-local` quiere YYYY-MM-DDTHH:mm en hora local, sin zona ni segundos. */
function aInputFecha(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
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
  titulo: string;
  descripcion: string;
  tipo: TipoPromocion;
  valor: string;
  categoriaId: string;
  fechaInicio: string;
  fechaFin: string;
  bannerImagen: string;
  activo: boolean;
}

const VACIO: Borrador = {
  titulo: '',
  descripcion: '',
  tipo: 'porcentaje',
  valor: '10',
  categoriaId: '',
  fechaInicio: aInputFecha(new Date().toISOString()),
  fechaFin: '',
  bannerImagen: '',
  activo: true,
};

const desde = (p: PromocionDTO): Borrador => ({
  titulo: p.titulo,
  descripcion: p.descripcion,
  tipo: p.tipo,
  valor: String(p.valor),
  categoriaId: p.categoriaId ?? '',
  fechaInicio: aInputFecha(p.fechaInicio),
  fechaFin: aInputFecha(p.fechaFin),
  bannerImagen: p.bannerImagen ?? '',
  activo: p.activo,
});

const ETIQUETA_TIPO: Record<TipoPromocion, string> = {
  porcentaje: 'Porcentaje de descuento',
  monto_fijo: 'Monto fijo en lempiras',
};

/** Vigente, programada o vencida — lo que el supervisor necesita ver de un vistazo. */
function estadoDe(p: PromocionDTO): { texto: string; clase: string } {
  const ahora = Date.now();
  if (!p.activo) return { texto: 'Desactivada', clase: 'text-suave' };
  if (new Date(p.fechaInicio).getTime() > ahora) return { texto: 'Programada', clase: 'text-ambar' };
  if (new Date(p.fechaFin).getTime() < ahora) return { texto: 'Vencida', clase: 'text-suave' };
  return { texto: 'Vigente', clase: 'text-verde' };
}

export default function AdminPromociones() {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<PromocionDTO | 'nueva' | null>(null);
  const [b, setB] = useState<Borrador>(VACIO);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promociones'],
    queryFn: () => api<PromocionDTO[]>('/promociones/admin/todas'),
  });

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
  });

  const refrescar = async () => {
    await qc.invalidateQueries({ queryKey: ['admin', 'promociones'] });
    await qc.invalidateQueries({ queryKey: ['promociones'] });
  };

  const abrir = (p: PromocionDTO | 'nueva') => {
    setError(null);
    setB(p === 'nueva' ? VACIO : desde(p));
    setEditando(p);
  };

  const guardar = useMutation({
    mutationFn: async () => {
      const payload = {
        titulo: b.titulo.trim(),
        descripcion: b.descripcion.trim(),
        tipo: b.tipo,
        valor: Number(b.valor),
        categoriaId: b.categoriaId || null,
        // El input entrega hora local; el servidor guarda en UTC.
        fechaInicio: new Date(b.fechaInicio).toISOString(),
        fechaFin: new Date(b.fechaFin).toISOString(),
        bannerImagen: b.bannerImagen.trim() || null,
        activo: b.activo,
      };
      if (editando === 'nueva')
        return api<PromocionDTO>('/promociones', { method: 'POST', body: payload });
      if (editando)
        return api<PromocionDTO>(`/promociones/${editando.id}`, { method: 'PATCH', body: payload });
    },
    onSuccess: async () => {
      await refrescar();
      setEditando(null);
    },
    onError: (e) => setError(mensajeDe(e, 'No se pudo guardar')),
  });

  const borrar = useMutation({
    mutationFn: (id: string) => api<void>(`/promociones/${id}`, { method: 'DELETE' }),
    onSuccess: refrescar,
    onError: (e) => setError(mensajeDe(e, 'No se pudo eliminar')),
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
        <h2 className="text-xl">{editando === 'nueva' ? 'Nueva promoción' : editando.titulo}</h2>
        {error && <Aviso>{error}</Aviso>}

        <label className="block">
          <span className="etiqueta">Título</span>
          <input
            required
            value={b.titulo}
            onChange={(e) => setB((x) => ({ ...x, titulo: e.target.value }))}
            className="campo mt-1"
            placeholder="Rebajas de temporada"
          />
        </label>

        <label className="block">
          <span className="etiqueta">Descripción</span>
          <textarea
            rows={4}
            value={b.descripcion}
            onChange={(e) => setB((x) => ({ ...x, descripcion: e.target.value }))}
            className="campo mt-1 resize-y"
            placeholder="Hasta 40% en vestidos seleccionados."
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta">Tipo de descuento</span>
            <select
              value={b.tipo}
              onChange={(e) => setB((x) => ({ ...x, tipo: e.target.value as TipoPromocion }))}
              className="campo mt-1"
            >
              {TIPOS_PROMOCION.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="etiqueta">Valor</span>
            <input
              required
              type="number"
              min={1}
              max={b.tipo === 'porcentaje' ? 100 : undefined}
              step="0.01"
              value={b.valor}
              onChange={(e) => setB((x) => ({ ...x, valor: e.target.value }))}
              className="campo mt-1"
            />
            <span className="mt-1 block text-xs text-suave">
              {b.tipo === 'porcentaje' ? 'Del 1 al 100.' : 'En lempiras.'}
            </span>
          </label>
        </div>

        <label className="block">
          <span className="etiqueta">Categoría (opcional)</span>
          <select
            value={b.categoriaId}
            onChange={(e) => setB((x) => ({ ...x, categoriaId: e.target.value }))}
            className="campo mt-1"
          >
            <option value="">Toda la tienda</option>
            {categorias?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="etiqueta">Empieza</span>
            <input
              required
              type="datetime-local"
              value={b.fechaInicio}
              onChange={(e) => setB((x) => ({ ...x, fechaInicio: e.target.value }))}
              className="campo mt-1"
            />
          </label>
          <label className="block">
            <span className="etiqueta">Termina</span>
            <input
              required
              type="datetime-local"
              value={b.fechaFin}
              onChange={(e) => setB((x) => ({ ...x, fechaFin: e.target.value }))}
              className="campo mt-1"
            />
          </label>
        </div>

        <CampoImagen
          valor={b.bannerImagen}
          onCambio={(url) => setB((x) => ({ ...x, bannerImagen: url }))}
          carpeta="promociones"
          etiqueta="Banner de la promoción"
        />

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={b.activo}
            onChange={(e) => setB((x) => ({ ...x, activo: e.target.checked }))}
          />
          Activa (se muestra en la tienda mientras esté dentro de las fechas)
        </label>

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
        <p className="text-sm text-suave">{data?.length ?? 0} promociones</p>
        <button onClick={() => abrir('nueva')} className="btn-principal">
          Nueva promoción
        </button>
      </div>

      {data && data.length === 0 ? (
        <p className="mt-8 text-sm text-suave">
          Todavía no hay promociones. Crea la primera con el botón de arriba.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-borde text-left">
                <th className="py-3 font-normal text-suave">Promoción</th>
                <th className="py-3 font-normal text-suave">Descuento</th>
                <th className="py-3 font-normal text-suave">Vigencia</th>
                <th className="py-3 font-normal text-suave">Estado</th>
                <th className="py-3 font-normal text-suave"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {data?.map((p) => {
                const est = estadoDe(p);
                return (
                  <tr key={p.id}>
                    <td className="flex items-center gap-3 py-3">
                      {p.bannerImagen ? (
                        <img
                          src={p.bannerImagen}
                          alt=""
                          loading="lazy"
                          className="h-12 w-20 object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-20 items-center justify-center bg-fondo text-[10px] text-suave">
                          sin banner
                        </span>
                      )}
                      <span className="block max-w-xs truncate">{p.titulo}</span>
                    </td>
                    <td className="py-3">
                      {p.tipo === 'porcentaje' ? `${p.valor}%` : formatLps(p.valor)}
                    </td>
                    <td className="py-3 text-suave">
                      {new Date(p.fechaInicio).toLocaleDateString('es-HN')} –{' '}
                      {new Date(p.fechaFin).toLocaleDateString('es-HN')}
                    </td>
                    <td className={`py-3 ${est.clase}`}>{est.texto}</td>
                    <td className="space-x-4 py-3 text-right">
                      <button
                        onClick={() => abrir(p)}
                        className="text-xs uppercase tracking-etiqueta hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`¿Eliminar la promoción "${p.titulo}"?`)) borrar.mutate(p.id);
                        }}
                        className="text-xs uppercase tracking-etiqueta text-acento hover:underline"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
