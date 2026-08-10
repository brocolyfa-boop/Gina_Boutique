import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ProductoDTO } from '@gina/shared';
import { formatLps } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { useCarrito } from '../store/carrito';
import { Aviso, Imagen, ProductoCard, Skeleton, Vacio } from '../components/ui';

type Detalle = ProductoDTO & { relacionados: ProductoDTO[] };

export default function Producto() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { agregar } = useCarrito();

  const [talla, setTalla] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [imagen, setImagen] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [agregado, setAgregado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ['producto', id],
    queryFn: () => api<Detalle>(`/productos/${id}`),
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-10 lg:grid-cols-2 lg:px-8">
        <Skeleton className="aspect-[4/5] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <Vacio
        titulo="Producto no disponible"
        texto="Puede que se haya agotado o ya no esté en catálogo."
        accion={
          <Link to="/catalogo" className="btn-principal">
            Ver catálogo
          </Link>
        }
      />
    );
  }

  const agotado = p.stock === 0;

  const alAgregar = async () => {
    setError(null);
    // Se valida aquí y también en el servidor; esto solo evita el viaje de ida.
    if (p.tallas.length > 0 && !talla) return setError('Elige una talla');
    if (p.colores.length > 0 && !color) return setError('Elige un color');

    setGuardando(true);
    try {
      await agregar(p, { productoId: p.id, cantidad, talla, color });
      setAgregado(true);
      setTimeout(() => setAgregado(false), 2500);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo agregar al carrito');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <nav className="etiqueta mb-6">
        <Link to="/" className="hover:text-tinta">
          Inicio
        </Link>
        {' / '}
        <Link to={`/catalogo?categoria=${p.categoria.slug}`} className="hover:text-tinta">
          {p.categoria.nombre}
        </Link>
      </nav>

      <div className="grid gap-12 lg:grid-cols-2">
        <div>
          <Imagen src={p.imagenes[imagen]} alt={p.nombre} />
          {p.imagenes.length > 1 && (
            <div className="mt-3 flex gap-3">
              {p.imagenes.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setImagen(i)}
                  aria-label={`Imagen ${i + 1}`}
                  className={`w-20 border transition ${i === imagen ? 'border-tinta' : 'border-borde'}`}
                >
                  <img src={src} alt="" loading="lazy" className="aspect-[4/5] w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl leading-tight">{p.nombre}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span
              className={`text-2xl ${p.descuentoPorcentaje != null ? 'text-acento' : ''}`}
            >
              {formatLps(p.precioFinal)}
            </span>
            {p.descuentoPorcentaje != null && (
              <>
                <span className="text-sm text-suave line-through">{formatLps(p.precio)}</span>
                <span className="bg-acento px-2 py-1 text-[10px] uppercase tracking-etiqueta text-white">
                  -{p.descuentoPorcentaje}%
                </span>
              </>
            )}
          </div>

          {p.descripcion && <p className="mt-5 text-sm leading-relaxed text-suave">{p.descripcion}</p>}

          {p.tallas.length > 0 && (
            <div className="mt-8">
              <p className="etiqueta">Talla</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.tallas.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTalla(t)}
                    className={`min-w-[3rem] border px-3 py-2 text-sm transition ${
                      t === talla ? 'border-tinta bg-tinta text-white' : 'border-borde hover:border-tinta'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {p.colores.length > 0 && (
            <div className="mt-6">
              <p className="etiqueta">Color</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {p.colores.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`border px-3 py-2 text-sm transition ${
                      c === color ? 'border-tinta bg-tinta text-white' : 'border-borde hover:border-tinta'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center gap-4">
            <div className="flex items-center border border-borde">
              <button
                onClick={() => setCantidad((c) => Math.max(1, c - 1))}
                aria-label="Quitar uno"
                className="px-4 py-3 text-lg leading-none hover:bg-fondo"
              >
                −
              </button>
              <span className="w-10 text-center text-sm">{cantidad}</span>
              <button
                onClick={() => setCantidad((c) => Math.min(p.stock, c + 1))}
                aria-label="Agregar uno"
                className="px-4 py-3 text-lg leading-none hover:bg-fondo"
              >
                +
              </button>
            </div>
            <p className="text-xs text-suave">
              {agotado
                ? 'Sin existencias'
                : p.stock <= 5
                  ? `¡Solo quedan ${p.stock}!`
                  : `${p.stock} disponibles`}
            </p>
          </div>

          {error && <div className="mt-5">
            <Aviso>{error}</Aviso>
          </div>}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => void alAgregar()}
              disabled={agotado || guardando}
              className="btn-principal flex-1"
            >
              {agotado ? 'Agotado' : guardando ? 'Agregando…' : agregado ? '✓ Agregado' : 'Agregar al carrito'}
            </button>
            <button
              onClick={async () => {
                await alAgregar();
                if (!agotado) navigate('/carrito');
              }}
              disabled={agotado || guardando}
              className="btn-secundario flex-1"
            >
              Comprar ahora
            </button>
          </div>

          <dl className="mt-10 space-y-2 border-t border-borde pt-6 text-sm text-suave">
            <div className="flex justify-between">
              <dt>Envío</dt>
              <dd>Fijo a los 18 departamentos</dd>
            </div>
            <div className="flex justify-between">
              <dt>Pago</dt>
              <dd>Contra entrega</dd>
            </div>
          </dl>
        </div>
      </div>

      {p.relacionados.length > 0 && (
        <section className="mt-24">
          <h2 className="text-2xl">También te puede gustar</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {p.relacionados.slice(0, 4).map((r) => (
              <ProductoCard key={r.id} producto={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
