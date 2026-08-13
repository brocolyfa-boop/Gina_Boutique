import crypto from 'node:crypto';
import { env } from '../env.js';
import { unprocessable } from './errors.js';

/**
 * Subida de imágenes a Cloudinary con firma.
 *
 * El navegador sube el archivo DIRECTO a Cloudinary; la API solo firma la
 * operación. Así las fotos no pasan por nuestro servidor: no hay que subir el
 * límite de 1 MB del body, ni gastar ancho de banda ni memoria del contenedor
 * en archivos que igual terminarían en Cloudinary.
 *
 * El `api_secret` nunca sale del servidor: se usa solo para calcular la firma.
 */

interface CredencialesCloudinary {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/** CLOUDINARY_URL viene como cloudinary://api_key:api_secret@cloud_name */
function leerCredenciales(): CredencialesCloudinary | null {
  if (!env.CLOUDINARY_URL) return null;
  try {
    const url = new URL(env.CLOUDINARY_URL);
    const apiKey = decodeURIComponent(url.username);
    const apiSecret = decodeURIComponent(url.password);
    const cloudName = url.hostname;
    if (!apiKey || !apiSecret || !cloudName) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

export const cloudinaryConfigurado = (): boolean => leerCredenciales() !== null;

export interface FirmaSubida {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  /** A dónde tiene que subir el navegador el archivo. */
  uploadUrl: string;
}

/**
 * Cloudinary firma la concatenación de los parámetros ordenados por nombre más
 * el api_secret. La firma incluye la carpeta, así que un token robado no sirve
 * para escribir fuera de ella.
 */
export function firmarSubida(carpeta: string): FirmaSubida {
  const cred = leerCredenciales();
  if (!cred) {
    throw unprocessable(
      'La subida de imágenes no está configurada. Falta CLOUDINARY_URL en el servidor.',
    );
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = { folder: carpeta, timestamp: String(timestamp) };

  const aFirmar = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const signature = crypto
    .createHash('sha1')
    .update(aFirmar + cred.apiSecret)
    .digest('hex');

  return {
    cloudName: cred.cloudName,
    apiKey: cred.apiKey,
    timestamp,
    folder: carpeta,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cred.cloudName}/image/upload`,
  };
}
