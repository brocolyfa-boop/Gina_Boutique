import { useQuery } from '@tanstack/react-query';
import type { ConfigPublicaDTO } from '@gina/shared';
import { MARCA, enlaceWhatsApp } from '@gina/shared';
import { api } from '../lib/api';

/**
 * Botón flotante de WhatsApp.
 *
 * En Honduras mucha gente pregunta por WhatsApp antes de comprar; sin esta
 * salida, la duda se convierte en una venta perdida en vez de en una
 * conversación.
 *
 * Si no hay número configurado (`TIENDA_WHATSAPP` en el servidor) no se pinta
 * nada: un botón que abre un chat vacío es peor que no tenerlo.
 */
export default function BotonWhatsApp() {
  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ConfigPublicaDTO>('/config'),
    staleTime: 10 * 60 * 1000,
  });

  // Si el servidor todavía no respondió (o no tiene la variable puesta) se usa
  // el número de la marca: el botón debe estar desde el primer pintado, que es
  // cuando el cliente está decidiendo si pregunta o se va.
  const numero = config?.whatsapp || MARCA.redes.whatsapp;
  const enlace = enlaceWhatsApp(numero, `Hola ${MARCA.nombre}, me interesa un producto.`);
  if (!enlace) return null;

  return (
    <a
      href={enlace}
      target="_blank"
      rel="noreferrer"
      aria-label="Escribirnos por WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-marco transition hover:brightness-95"
    >
      {/* El logotipo va en SVG: una imagen externa sería una petición más y no
          se vería si la red del cliente va lenta, que es justo cuando importa. */}
      <svg viewBox="0 0 24 24" aria-hidden className="h-7 w-7 fill-white">
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.48-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
        <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.48 1.34 5L2 22l5.19-1.36a9.93 9.93 0 0 0 4.85 1.24h.01c5.5 0 9.96-4.46 9.96-9.96 0-2.66-1.04-5.16-2.92-7.04A9.9 9.9 0 0 0 12.04 2zm0 18.14h-.01a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.13.82.84-3.05-.2-.31a8.25 8.25 0 1 1 7.01 3.87z" />
      </svg>
    </a>
  );
}
