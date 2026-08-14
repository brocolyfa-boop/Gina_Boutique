import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MARCA, enlaceWhatsApp } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/**
 * Recuperar la contraseña por WhatsApp.
 *
 * Se pide el número y no el correo porque en Honduras el WhatsApp es el canal
 * que la gente sí revisa, y es por donde la tienda ya atiende todo lo demás.
 *
 * La pantalla tiene dos pasos y un caso aparte:
 *
 *  - paso 1: el número, que dispara el código;
 *  - paso 2: el código de 6 dígitos y la contraseña nueva;
 *  - con `?token=` en la dirección se atiende el enlace por correo, que sigue
 *    sirviendo para cuando la tienda tenga envío de correo configurado.
 */
export default function Recuperar() {
  const [params] = useSearchParams();
  const token = params.get('token');
  useTitulo('Recuperar mi contraseña');

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
            : 'Te mandamos un código por WhatsApp para que puedas entrar de nuevo.'}
        </p>
      </div>

      {token ? <PorEnlace token={token} /> : <PorWhatsApp />}

      <p className="mt-6 text-center text-xs text-suave">
        <Link to="/entrar" className="hover:text-tinta">
          Volver a entrar
        </Link>
      </p>
    </div>
  );
}

function PorWhatsApp() {
  const navigate = useNavigate();
  const [paso, setPaso] = useState<'telefono' | 'codigo'>('telefono');
  const [telefono, setTelefono] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetir, setRepetir] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const ayuda = enlaceWhatsApp(
    MARCA.redes.whatsapp,
    'Hola, pedí el código para recuperar mi contraseña y no me ha llegado.',
  );

  const pedirCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await api('/auth/recuperar-whatsapp', { method: 'POST', body: { telefono } });
      setPaso('codigo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos procesar tu solicitud.');
    } finally {
      setEnviando(false);
    }
  };

  const cambiar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nueva !== repetir) return setError('Las dos contraseñas no son iguales');

    setError(null);
    setEnviando(true);
    try {
      await api('/auth/restablecer-codigo', { method: 'POST', body: { telefono, codigo, nueva } });
      setListo(true);
      // Cambiar la contraseña cierra las sesiones abiertas, así que hay que
      // volver a entrar: se lleva a esa pantalla en vez de dejarlo a medias.
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

  if (paso === 'telefono') {
    return (
      <form onSubmit={pedirCodigo} className="tarjeta mt-8 space-y-4 p-6">
        <label className="block">
          <span className="etiqueta">Tu número de WhatsApp</span>
          <input
            required
            inputMode="tel"
            autoComplete="tel"
            placeholder="9999-9999"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="campo mt-2"
          />
          <span className="mt-1 block text-xs text-suave">
            El mismo con el que hiciste tu cuenta.
          </span>
        </label>

        {error && <Aviso>{error}</Aviso>}

        <button type="submit" disabled={enviando} className="btn-principal w-full">
          {enviando ? 'Enviando…' : 'Mandarme el código'}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={cambiar} className="tarjeta mt-8 space-y-4 p-6">
      {/*
        El aviso no confirma si el número tenía cuenta. Decir "ese número no
        está registrado" dejaría averiguar qué teléfonos son clientes.
      */}
      <p className="border border-borde bg-fondo px-4 py-3 text-sm">
        Si <strong>{telefono}</strong> tiene una cuenta, te llega un código por WhatsApp.
        <span className="mt-1 block text-xs text-suave">
          Vence en 10 minutos. Si la tienda está atendiendo, puede tardar unos minutos.
        </span>
      </p>

      <label className="block">
        <span className="etiqueta">Código de 6 dígitos</span>
        <input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          className="campo mt-2 text-center text-lg tracking-[0.4em]"
        />
      </label>

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

      <div className="flex flex-wrap justify-between gap-3 border-t border-borde pt-4 text-xs">
        <button
          type="button"
          onClick={() => {
            setPaso('telefono');
            setCodigo('');
            setError(null);
          }}
          className="text-suave underline hover:text-tinta"
        >
          Usar otro número
        </button>
        {ayuda && (
          <a
            href={ayuda}
            target="_blank"
            rel="noreferrer"
            className="text-suave underline hover:text-tinta"
          >
            No me llegó el código
          </a>
        )}
      </div>
    </form>
  );
}

/** Enlace por correo. Sigue sirviendo cuando haya envío de correo configurado. */
function PorEnlace({ token }: { token: string }) {
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
