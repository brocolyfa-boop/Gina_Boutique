import type { OrdenDTO } from '@gina/shared';
import { resumenPedidoWhatsApp } from '@gina/shared';
import { env } from '../env.js';

/**
 * Aviso de pedido nuevo.
 *
 * Sin esto un pedido cae en la base y ahí se queda: si nadie abre el panel, no
 * se entera nadie, y un pedido que tarda un día en verse es un cliente perdido.
 *
 * Hay tres canales y se usan los que estén configurados. Si no hay ninguno, el
 * resumen sale por consola, que en Railway queda en los logs del servicio: es
 * peor que un WhatsApp, pero mucho mejor que el silencio.
 *
 * Nada de esto puede tumbar el pedido. El cliente ya pagó su parte del trato en
 * el momento en que la orden se guardó; que falle un aviso es problema nuestro,
 * no suyo.
 */

const TIEMPO_LIMITE_MS = 8000;

async function conLimite(url: string, init: RequestInit): Promise<Response> {
  // Sin timeout, una API caída dejaría la petición colgada consumiendo un
  // proceso hasta que el sistema operativo se aburra.
  const abortar = AbortSignal.timeout(TIEMPO_LIMITE_MS);
  return fetch(url, { ...init, signal: abortar });
}

/** WhatsApp Cloud API de Meta. Requiere token, id del número y destinatario. */
async function porWhatsApp(texto: string): Promise<void> {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, WHATSAPP_DESTINO } = env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID || !WHATSAPP_DESTINO) return;

  const res = await conLimite(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: WHATSAPP_DESTINO,
      type: 'text',
      text: { body: texto },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp respondió ${res.status}: ${await res.text()}`);
  }
}

/** Correo por Resend. Se eligió por no necesitar servidor SMTP propio. */
async function porCorreo(asunto: string, texto: string): Promise<void> {
  const { RESEND_API_KEY, NOTIFICAR_EMAIL, NOTIFICAR_EMAIL_DESDE } = env;
  if (!RESEND_API_KEY || !NOTIFICAR_EMAIL) return;

  const res = await conLimite('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFICAR_EMAIL_DESDE,
      to: [NOTIFICAR_EMAIL],
      subject: asunto,
      text: texto,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
  }
}

/**
 * Correo a una dirección concreta, no al buzón de la tienda.
 *
 * `porCorreo` siempre escribe a NOTIFICAR_EMAIL, que es la dueña. Para
 * recuperar una contraseña hay que escribirle al cliente, así que el
 * destinatario viaja como parámetro.
 *
 * Devuelve false si no hay correo configurado, para que quien llame pueda
 * decirle la verdad al usuario en vez de fingir que el mensaje salió.
 */
export async function enviarCorreoA(
  destino: string,
  asunto: string,
  texto: string,
): Promise<boolean> {
  const { RESEND_API_KEY, NOTIFICAR_EMAIL_DESDE } = env;
  if (!RESEND_API_KEY) return false;

  const res = await conLimite('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: NOTIFICAR_EMAIL_DESDE,
      to: [destino],
      subject: asunto,
      text: texto,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend respondió ${res.status}: ${await res.text()}`);
  }
  return true;
}

export function hayCorreoConfigurado(): boolean {
  return Boolean(env.RESEND_API_KEY);
}

/**
 * WhatsApp a un número concreto, no al de la tienda.
 *
 * `porWhatsApp` avisa siempre a WHATSAPP_DESTINO, que es la dueña. Un código de
 * recuperación va al cliente, así que el destinatario viaja como parámetro.
 *
 * Devuelve false si Meta no está configurado, para que quien llame lo deje
 * pendiente en el panel en vez de dar por enviado algo que nunca salió.
 */
export async function enviarWhatsAppA(destino: string, texto: string): Promise<boolean> {
  const { WHATSAPP_TOKEN, WHATSAPP_PHONE_ID } = env;
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) return false;

  const res = await conLimite(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: destino,
      type: 'text',
      text: { body: texto },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp respondió ${res.status}: ${await res.text()}`);
  }
  return true;
}

export function hayCanalConfigurado(): boolean {
  return Boolean(
    (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID && env.WHATSAPP_DESTINO) ||
      (env.RESEND_API_KEY && env.NOTIFICAR_EMAIL),
  );
}

/**
 * Avisa del pedido y nunca lanza. Se llama sin esperar el resultado: el cliente
 * no tiene por qué mirar una pantalla de carga mientras hablamos con Meta.
 */
export async function notificarPedidoNuevo(orden: OrdenDTO): Promise<void> {
  const texto = resumenPedidoWhatsApp(orden);
  const asunto = `Pedido nuevo ${orden.numero} · ${orden.municipio}`;

  if (!hayCanalConfigurado()) {
    console.warn(`[PEDIDO NUEVO] ${asunto}\n${texto}`);
    return;
  }

  // Los canales van en paralelo y se reportan por separado: que WhatsApp falle
  // no debe impedir que salga el correo.
  const resultados = await Promise.allSettled([porWhatsApp(texto), porCorreo(asunto, texto)]);

  for (const r of resultados) {
    if (r.status === 'rejected') {
      console.error(`No se pudo avisar del pedido ${orden.numero}:`, r.reason);
      // El aviso se pierde pero el pedido no: queda en consola como respaldo.
      console.warn(`[PEDIDO NUEVO] ${asunto}\n${texto}`);
    }
  }
}
