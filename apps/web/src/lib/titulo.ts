import { useEffect } from 'react';
import { MARCA } from '@gina/shared';

/**
 * Título y descripción de la pestaña según la página.
 *
 * Sin esto todas las pantallas comparten el mismo título: alguien con cinco
 * pestañas abiertas no distingue cuál es cuál, y los buscadores indexan la
 * tienda entera bajo un solo nombre.
 *
 * Un hook y no un `<Helmet>`: son dos etiquetas y no vale traerse una
 * dependencia para eso.
 */
export function useTitulo(titulo: string | null, descripcion?: string): void {
  useEffect(() => {
    const previo = document.title;
    document.title = titulo ? `${titulo} — ${MARCA.nombre}` : `${MARCA.nombre} — ${MARCA.tagline}`;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previoDesc = meta?.content ?? null;
    if (descripcion) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = descripcion;
    }

    // Al salir se restaura: si no, la descripción de un producto se quedaría
    // puesta al volver al catálogo.
    return () => {
      document.title = previo;
      if (meta && previoDesc !== null) meta.content = previoDesc;
    };
  }, [titulo, descripcion]);
}
