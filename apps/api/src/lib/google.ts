import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';
import { badRequest, unauthorized } from './errors.js';

/**
 * Verificación del token de Google.
 *
 * Aquí está todo lo delicado de "Entrar con Google". El navegador manda un
 * token firmado por Google y este módulo comprueba que sea auténtico antes de
 * dejar entrar a nadie. Confiar en el correo que venga en el cuerpo de la
 * petición, sin verificar la firma, dejaría entrar a cualquiera a la cuenta que
 * quisiera con solo escribir el correo ajeno.
 *
 * La librería oficial hace tres cosas que no conviene escribir a mano: baja las
 * llaves públicas de Google y las cachea, comprueba la firma y valida que el
 * token sea para NOSOTROS (`aud`) y no uno emitido para otra aplicación.
 */

// Se crea una vez: el cliente guarda en memoria los certificados de Google y
// crearlo por petición tiraría esa caché a la basura en cada login.
const cliente = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface IdentidadGoogle {
  /** `sub`: el id de Google, estable aunque la persona cambie de correo. */
  googleId: string;
  email: string;
  nombre: string;
}

export const googleDisponible = (): boolean => Boolean(env.GOOGLE_CLIENT_ID);

export async function verificarTokenGoogle(credential: string): Promise<IdentidadGoogle> {
  if (!googleDisponible()) {
    throw badRequest('Entrar con Google no está disponible en este momento');
  }

  let payload;
  try {
    const ticket = await cliente.verifyIdToken({
      idToken: credential,
      // Sin esto, un token legítimo emitido para OTRA app sería aceptado aquí.
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    // No se filtra el motivo exacto: a quien prueba tokens no hay que darle pistas.
    throw unauthorized('No pudimos verificar tu cuenta de Google');
  }

  if (!payload?.sub || !payload.email) {
    throw unauthorized('Google no devolvió los datos necesarios');
  }

  /*
    `email_verified` importa de verdad: abajo la cuenta de Google se enlaza con
    una cuenta existente que tenga el mismo correo. Si Google no confirma que la
    persona es dueña de ese correo, ese enlace sería una forma de entrar a la
    cuenta de otro.
  */
  if (!payload.email_verified) {
    throw unauthorized('Tu correo de Google no está verificado');
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    nombre: payload.name?.trim() || payload.email.split('@')[0] || 'Cliente',
  };
}
