import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { CategoriaDTO, Paginado, ProductoDTO } from '@gina/shared';
import { TALLAS_CALZADO, TALLAS_ROPA, formatLps } from '@gina/shared';
import { api } from '../lib/api';
import { ProductoCard, SkeletonProductos, Vacio } from '../components/ui';
import { useTitulo } from '../lib/titulo';

const ORDENES = [
  { valor: 'nuevos', texto: 'Más recientes' },
  { valor: 'precio_asc', texto: 'Precio: menor a mayor' },
  { valor: 'precio_desc', texto: 'Precio: mayor a menor' },
  { valor: 'nombre', texto: 'Nombre A-Z' },
] as const;

const TALLAS = [...TALLAS_ROPA, ...TALLAS_CALZADO];

export default function Catalogo() {
  const [params, setParams] = useSearchParams();

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
    staleTime: 10 * 60 * 1000,
  });

  const categoriaActual = categorias?.find((c) => c.slug === params.get('categoria'));

  const busqueda = params.get('q');
  useTitulo(
    busqueda
      ? `Búsqueda: ${busqueda}`
      : params.get('enOferta')
        ? 'Ofertas'
        : (categoriaActual?.nombre ?? 'Catálogo'),
  );

  const cambiar = (clave: string, valor: string | null) => {
    const siguiente = new URLSearchParams(params);
    if (valor) siguiente.set(clave, valor);
    else siguiente.delete(clave);
    // Cambiar un filtro reinicia la paginación.
    siguiente.delete('page');
    setParams(siguiente, { replace: true });
  };

  const consulta = new URLSearchParams(params);
  consulta.set('limit', '24');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['productos', consulta.toString()],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams(consulta);
      q.set('page', String(pageParam));
      return api<Paginado<ProductoDTO>>(`/productos?${q.toString()}`);
    },
    getNextPageParam: (ultima) => (ultima.hasNextPage ? ultima.page + 1 : undefined),
  });

  const productos = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  const filtrosActivos = ['categoria', 'subcategoria', 'talla', 'color', 'precioMin', 'precioMax', 'enOferta', 'destacado', 'q'].filter(
    (k) => params.get(k),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <header>
        <h1 className="text-3xl">
          {params.get('q')
            ? `Resultados para "${params.get('q')}"`
            : params.get('enOferta')
              ? 'Ofertas'
              : (categoriaActual?.nombre ?? 'Catálogo')}
        </h1>
        {!isLoading && (
          <p className="mt-2 text-sm text-suave">
            {total} {total === 1 ? 'producto' : 'productos'}
          </p>
        )}
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside className="space-y-8">
          {filtrosActivos.length > 0 && (
            <button
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="text-xs uppercase tracking-etiqueta text-acento hover:underline"
            >
              Limpiar filtros ({filtrosActivos.length})
            </button>
          )}

          <div>
            <p className="etiqueta">Categoría</p>
            <ul className="mt-3 space-y-2 text-sm">
              {categorias?.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => cambiar('categoria', c.slug === params.get('categoria') ? null : c.slug)}
                    className={`transition hover:text-tinta ${
                      c.slug === params.get('categoria') ? 'font-medium text-tinta underline' : 'text-suave'
                    }`}
                  >
                    {c.nombre} <span className="text-xs">({c.totalProductos ?? 0})</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {categoriaActual && categoriaActual.subcategorias.length > 0 && (
            <div>
              <p className="etiqueta">Tipo</p>
              <ul className="mt-3 space-y-2 text-sm">
                {categoriaActual.subcategorias.map((s) => (
                  <li key={s}>
                    <button
                      onClick={() => cambiar('subcategoria', s === params.get('subcategoria') ? null : s)}
                      className={`capitalize transition hover:text-tinta ${
                        s === params.get('subcategoria') ? 'font-medium text-tinta underline' : 'text-suave'
                      }`}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="etiqueta">Talla</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {TALLAS.map((t) => (
                <button
                  key={t}
                  onClick={() => cambiar('talla', t === params.get('talla') ? null : t)}
                  className={`min-w-[2.5rem] border px-2 py-1 text-xs transition ${
                    t === params.get('talla')
                      ? 'border-tinta bg-tinta text-white'
                      : 'border-borde hover:border-tinta'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="etiqueta">Precio ({formatLps(0).slice(0, 1)})</p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="Desde"
                defaultValue={params.get('precioMin') ?? ''}
                onBlur={(e) => cambiar('precioMin', e.target.value || null)}
                className="campo py-2"
              />
              <span className="text-suave">–</span>
              <input
                type="number"
                min={0}
                placeholder="Hasta"
                defaultValue={params.get('precioMax') ?? ''}
                onBlur={(e) => cambiar('precioMax', e.target.value || null)}
                className="campo py-2"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={params.get('enOferta') === 'true'}
              onChange={(e) => cambiar('enOferta', e.target.checked ? 'true' : null)}
            />
            Solo ofertas
          </label>
        </aside>

        <div>
          <div className="flex justify-end">
            <select
              value={params.get('orden') ?? 'nuevos'}
              onChange={(e) => cambiar('orden', e.target.value)}
              aria-label="Ordenar"
              className="campo w-auto py-2"
            >
              {ORDENES.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.texto}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6">
            {isLoading ? (
              <SkeletonProductos cantidad={12} />
            ) : productos.length === 0 ? (
              <Vacio
                titulo="No encontramos nada"
                texto="Prueba con menos filtros o busca otra palabra."
                accion={
                  <button
                    onClick={() => setParams(new URLSearchParams(), { replace: true })}
                    className="btn-secundario"
                  >
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
                  {productos.map((p) => (
                    <ProductoCard key={p.id} producto={p} />
                  ))}
                </div>
                {hasNextPage && (
                  <div className="mt-12 text-center">
                    <button
                      onClick={() => void fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="btn-secundario"
                    >
                      {isFetchingNextPage ? 'Cargando…' : 'Ver más'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
