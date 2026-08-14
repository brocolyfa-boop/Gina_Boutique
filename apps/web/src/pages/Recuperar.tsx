import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MARCA } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/**
 * Recuperar la contraseña. La misma pantalla cubre los dos momentos:
 *
 *  - sin `?token=` pide el correo y manda el enlace;
 *  - con `?token=` (el del correo) deja elegir la contraseña nueva.
 *
 * Van juntas porque comparten encabezado, estilo y mensajes; separarlas en dos
 * archivos duplicaba todo para cambiar cuatro líneas.
 */
export default function Recuperar() {
  const [params] = useSearchParams();
  const token = params.get('token');
  useTitulo(token ? 'Elegir contraseña nueva' : 'Recuperar contraseña');

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center">
        <img src={MARCA.logoUrl} alt="" className="mx-auto h-16 w-16 object-contain" />
        <h1 className="mt-4 text-3xl">
          {token ? 'Elige tu contraseña nueva' : '¿Olvidaste tu contraseña?'}
        </h1>
        <p className="mt-2 text-sm text-suave">
          {token
            ? 'Escríbela dos veces para no equivocarte.'
            : 'Escribe tu correo y te mandamos un enlace para crear una nueva.'}
        </p>
      </div>

      {token ? <Restablecer token={token} /> : <Pedir />}

      <p className="mt-6 text-center text-xs text-suave">
        <Link to="/entrar" className="hover:text-tinta">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}

function Pedir() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api('/auth/recuperar', { method: 'POST', body: { email } });
      setListo(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos enviar el correo. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  /*
    El mensaje no confirma si el correo estaba registrado. Decir "no existe esa
    cuenta" dejaría que cualquiera averigüe qué clientes tiene la tienda
    probando direcciones.
  */
  if (listo) {
    return (
      <div className="tarjeta mt-8 p-6 text-center">
        <p className="text-sm">
          Si <strong>{email}</strong> tiene una cuenta, ya le mandamos un enlace para crear la
          contraseña nueva.
        </p>
        <p className="mt-3 text-xs text-suave">
          Revisa también la carpeta de correo no deseado. El enlace vence en una hora.
        </p>
        <p className="mt-5 text-xs text-suave">
          ¿No te llegó? Escríbenos por WhatsApp al {MARCA.redes.whatsapp} y te ayudamos.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta mt-8 space-y-4 p-6">
      <label className="block">
        <span className="etiqueta">Correo</span>
        <input
          required
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="campo mt-2"
        />
      </label>

      {error && <Aviso>{error}</Aviso>}

      <button type="submit" disabled={enviando} className="btn-principal w-full">
        {enviando ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
    </form>
  );
}

function Restablecer({ token }: { token: string }) {
  const navigate = useNavigate();
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetir) return setError('Las dos contraseñas no son iguales');

    setError(null);
    setEnviando(true);
    try {
      await api('/auth/restablecer', { method: 'POST', body: { token, nueva } });
      setListo(true);
      // Se manda a entrar con la contraseña nueva: cambiarla cierra las
      // sesiones abiertas, así que no se puede entrar solo.
      setTimeout(() => navigate('/entrar', { replace: true }), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setEnviando(false);
    }
  };

  if (listo) {
    return (
      <div className="tarjeta mt-8 p-6 text-center">
        <Aviso tipo="ok">Tu contraseña quedó cambiada.</Aviso>
        <p className="mt-4 text-sm text-suave">Te llevamos a entrar…</p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="tarjeta mt-8 space-y-4 p-6">
      <label className="block">
        <span className="etiqueta">Contraseña nueva</span>
        <input
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className="campo mt-2"
        />
        <span className="mt-1 block text-xs text-suave">Al menos 8 caracteres.</span>
      </label>

      <label className="block">
        <span className="etiqueta">Repite la contraseña</span>
        <input
          required
          minLength={8}
          type="password"
          autoComplete="new-password"
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          className="campo mt-2"
        />
      </label>

      {error && <Aviso>{error}</Aviso>}

      <button type="submit" disabled={enviando} className="btn-principal w-full">
        {enviando ? 'Guardando…' : 'Cambiar mi contraseña'}
      </button>
    </form>
  );
}
