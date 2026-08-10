import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ProductoDTO } from '@gina/shared';
import { formatLps } from '@gina/shared';

/** Imagen con carga diferida y un fondo que evita el salto de layout. */
export function Imagen({
  src,
  alt,
  className = '',
  ratio = 'aspect-[4/5]',
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  ratio?: string;
}) {
  const [lista, setLista] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-[#F1EEEC] ${ratio} ${className}`}>
      {src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLista(true)}
          className={`h-full w-full object-cover transition-opacity duration-500 ${
            lista ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

/** Bloques de carga con la forma del contenido real, no un spinner genérico. */
export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`skeleton ${className}`} />
);

export function SkeletonProductos({ cantidad = 8 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5] w-full" />
          <Skeleton className="mt-3 h-3 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function ProductoCard({ producto }: { producto: ProductoDTO }) {
  const enOferta = producto.descuentoPorcentaje != null;
  return (
    <Link to={`/producto/${producto.id}`} className="group block">
      <div className="relative">
        <Imagen src={producto.imagenes[0]} alt={producto.nombre} />
        {enOferta && (
          <span className="absolute left-0 top-3 bg-acento px-3 py-1 text-[10px] font-medium uppercase tracking-etiqueta text-white">
            -{producto.descuentoPorcentaje}%
          </span>
        )}
        {producto.stock === 0 && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs uppercase tracking-etiqueta">
            Agotado
          </span>
        )}
      </div>
      <h3 className="mt-3 font-sans text-sm leading-snug transition group-hover:underline">
        {producto.nombre}
      </h3>
      <p className="mt-1 flex items-baseline gap-2 text-sm">
        <span className={enOferta ? 'font-medium text-acento' : 'font-medium'}>
          {formatLps(producto.precioFinal)}
        </span>
        {enOferta && <span className="text-xs text-suave line-through">{formatLps(producto.precio)}</span>}
      </p>
    </Link>
  );
}

export function Aviso({ children, tipo = 'error' }: { children: React.ReactNode; tipo?: 'error' | 'ok' }) {
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`border px-4 py-3 text-sm ${
        tipo === 'error'
          ? 'border-acento/30 bg-acento/5 text-acento'
          : 'border-borde bg-fondo text-tinta'
      }`}
    >
      {children}
    </p>
  );
}

export function Vacio({ titulo, texto, accion }: { titulo: string; texto: string; accion?: React.ReactNode }) {
  return (
    <div className="py-24 text-center">
      <h2 className="text-2xl">{titulo}</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-suave">{texto}</p>
      {accion && <div className="mt-8">{accion}</div>}
    </div>
  );
}
