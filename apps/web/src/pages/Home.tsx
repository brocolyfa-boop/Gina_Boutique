import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CategoriaDTO, Paginado, ProductoDTO, PromocionDTO } from '@gina/shared';
import { MARCA } from '@gina/shared';
import { api } from '../lib/api';
import { Imagen, ProductoCard, SkeletonProductos } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/** Cuenta atrás hasta el fin de la promoción. */
function Cuenta({ hasta }: { hasta: string }) {
  const objetivo = new Date(hasta).getTime();
  const [restante, setRestante] = useState(objetivo - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRestante(objetivo - Date.now()), 1000);
    return () => clearInterval(id);
  }, [objetivo]);

  if (restante <= 0) return null;

  const seg = Math.floor(restante / 1000);
  const partes = [
    { valor: Math.floor(seg / 86400), etiqueta: 'días' },
    { valor: Math.floor((seg % 86400) / 3600), etiqueta: 'horas' },
    { valor: Math.floor((seg % 3600) / 60), etiqueta: 'min' },
    { valor: seg % 60, etiqueta: 'seg' },
  ];

  return (
    <div className="flex gap-3">
      {partes.map((p) => (
        <div key={p.etiqueta} className="min-w-[3.5rem] border border-white/30 px-2 py-1 text-center">
          <span className="block font-display text-xl leading-none">
            {String(p.valor).padStart(2, '0')}
          </span>
          <span className="text-[10px] uppercase tracking-etiqueta opacity-80">{p.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

function Promociones() {
  const { data } = useQuery({
    queryKey: ['promociones'],
    queryFn: () => api<PromocionDTO[]>('/promociones'),
  });

  if (!data || data.length === 0) return null;

  /*
    El banner sale del campo `bannerImagen` que se sube desde el panel.

    Antes había una foto guardada en el proyecto que se mostraba comparando el
    título de la promoción con un texto escrito a mano: bastaba renombrarla para
    que la imagen desapareciera sin aviso, y ninguna otra promoción podía tener
    la suya. Ahora cada promoción trae la propia y sin foto queda el fondo en
    tinta, que se ve bien igual.

    Las de placehold.co se descartan porque son texto de relleno del seed.
  */
  const imagenPromocion = (promo: PromocionDTO) =>
    promo.bannerImagen?.includes('placehold.co') ? null : promo.bannerImagen;

  return (
    <section className="mx-auto max-w-7xl px-4 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-2">
        {data.map((promo) => {
          const imagen = imagenPromocion(promo);

          return (
            <article
              key={promo.id}
              className="relative flex min-h-[24rem] flex-col justify-end overflow-hidden bg-tinta p-8 text-white"
            >
              {imagen && (
                <img
                  src={imagen}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover object-center"
                />
              )}
              {imagen && (
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-black/10" />
              )}
              <div className="relative max-w-md">
                <p className="etiqueta text-white/70">Promoción</p>
                <h2 className="mt-2 text-3xl leading-tight">{promo.titulo}</h2>
                <p className="mt-2 max-w-md text-sm text-white/80">{promo.descripcion}</p>
                <div className="mt-5">
                  <Cuenta hasta={promo.fechaFin} />
                </div>
                <Link
                  to={
                    promo.categoriaId
                      ? `/catalogo?categoria=${promo.categoriaId}`
                      : '/catalogo?enOferta=true'
                  }
                  className="mt-6 inline-block border border-white px-6 py-3 text-xs uppercase tracking-etiqueta transition hover:bg-white hover:text-tinta"
                >
                  Ver la promoción
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function Home() {
  useTitulo(null, 'Ropa, calzado y accesorios de mujer en Honduras. Envío a los 18 departamentos, entrega en 1 a 2 días y pago contra entrega.');

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
    staleTime: 10 * 60 * 1000,
  });

  const { data: destacados, isLoading } = useQuery({
    queryKey: ['productos', 'destacados'],
    queryFn: () => api<Paginado<ProductoDTO>>('/productos?destacado=true&limit=8'),
  });

  const { data: nuevos } = useQuery({
    queryKey: ['productos', 'nuevos'],
    queryFn: () => api<Paginado<ProductoDTO>>('/productos?orden=nuevos&limit=8'),
  });

  return (
    <div className="space-y-20 py-10">
      {/* Portada: tipografía y aire, sin bloque de color. La marca es el blanco. */}
      <section className="mx-auto max-w-7xl px-4 text-center lg:px-8">
        <p className="etiqueta">Nueva temporada</p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight md:text-6xl">
          {MARCA.tagline}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm text-suave">
          Ropa, calzado y accesorios seleccionados. Envíos a todo Honduras.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link to="/catalogo" className="btn-principal">
            Ver catálogo
          </Link>
          <Link to="/catalogo?enOferta=true" className="btn-secundario">
            Ofertas
          </Link>
        </div>
      </section>

      <Promociones />

      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <h2 className="text-2xl">Categorías</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {categorias?.map((c) => (
            <Link key={c.id} to={`/catalogo?categoria=${c.slug}`} className="group">
              <Imagen src={c.imagen} alt={c.nombre} ratio="aspect-[3/4]" />
              <p className="mt-2 text-center text-sm uppercase tracking-etiqueta transition group-hover:underline">
                {c.nombre}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Destacados</h2>
          <Link to="/catalogo?destacado=true" className="etiqueta hover:text-tinta">
            Ver todos
          </Link>
        </div>
        <div className="mt-6">
          {isLoading ? (
            <SkeletonProductos />
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {destacados?.data.map((p) => (
                <ProductoCard key={p.id} producto={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Nuevos ingresos</h2>
          <Link to="/catalogo" className="etiqueta hover:text-tinta">
            Ver todos
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {nuevos?.data.map((p) => (
            <ProductoCard key={p.id} producto={p} />
          ))}
        </div>
      </section>
    </div>
  );
}
