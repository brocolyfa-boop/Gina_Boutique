import { api } from './api';

interface FirmaSubida {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

export type CarpetaImagen = 'productos' | 'categorias' | 'promociones';

/** Cloudinary rechaza archivos grandes; avisar antes ahorra una subida perdida. */
const MAX_BYTES = 10 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Sube una foto a Cloudinary y devuelve su URL.
 *
 * El archivo va DIRECTO del navegador a Cloudinary: la API solo firma la
 * operación. Por eso no hay límite de tamaño del servidor ni espera doble.
 */
export async function subirImagen(
  archivo: File,
  carpeta: CarpetaImagen = 'productos',
): Promise<string> {
  if (!TIPOS.includes(archivo.type)) {
    throw new Error('Formato no admitido. Usa JPG, PNG, WebP o AVIF.');
  }
  if (archivo.size > MAX_BYTES) {
    throw new Error(`La imagen pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB. El máximo son 10 MB.`);
  }

  const firma = await api<FirmaSubida>('/imagenes/firma', {
    method: 'POST',
    body: { carpeta },
  });

  const datos = new FormData();
  datos.append('file', archivo);
  datos.append('api_key', firma.apiKey);
  datos.append('timestamp', String(firma.timestamp));
  datos.append('folder', firma.folder);
  datos.append('signature', firma.signature);

  const res = await fetch(firma.uploadUrl, { method: 'POST', body: datos });
  if (!res.ok) {
    // Cloudinary explica bien qué pasó; ese mensaje sirve más que uno genérico.
    const detalle = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(detalle?.error?.message ?? 'Cloudinary rechazó la imagen');
  }

  const subida = (await res.json()) as { secure_url?: string };
  if (!subida.secure_url) throw new Error('Cloudinary no devolvió la URL de la imagen');
  return subida.secure_url;
}
