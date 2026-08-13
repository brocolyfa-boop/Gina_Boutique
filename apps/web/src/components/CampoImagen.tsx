import { useRef, useState } from 'react';
import { subirImagen, type CarpetaImagen } from '../lib/subirImagen';

/**
 * Una sola imagen: se sube desde el disco o se pega una URL.
 *
 * La opción de pegar URL no es un adorno. Si Cloudinary todavía no está
 * configurado en el servidor, la subida falla y sin esta salida no habría forma
 * de ponerle foto a nada.
 */
export default function CampoImagen({
  valor,
  onCambio,
  carpeta,
  etiqueta = 'Imagen',
}: {
  valor: string;
  onCambio: (url: string) => void;
  carpeta: CarpetaImagen;
  etiqueta?: string;
}) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  const alSubir = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      onCambio(await subirImagen(archivo, carpeta));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  return (
    <div>
      <span className="etiqueta">{etiqueta}</span>
      <div className="mt-2 flex flex-wrap items-start gap-4">
        {valor ? (
          <div className="relative">
            <img src={valor} alt="" className="h-24 w-24 border border-borde object-cover" />
            <button
              type="button"
              onClick={() => onCambio('')}
              aria-label="Quitar imagen"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center border border-borde bg-white text-xs"
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center border border-dashed border-borde text-[10px] text-suave">
            sin imagen
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          <input
            ref={archivoRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={(e) => void alSubir(e.target.files?.[0])}
            disabled={subiendo}
            className="campo py-2 text-sm"
          />
          <input
            type="url"
            value={valor}
            onChange={(e) => onCambio(e.target.value)}
            placeholder="…o pega aquí la dirección de una imagen"
            className="campo py-2 text-sm"
          />
          {subiendo && <p className="text-xs text-suave">Subiendo…</p>}
          {error && <p className="text-xs text-acento">{error}</p>}
        </div>
      </div>
    </div>
  );
}
