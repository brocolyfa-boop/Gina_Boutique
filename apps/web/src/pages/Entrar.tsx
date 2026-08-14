import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MARCA } from '@gina/shared';
import { ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Aviso } from '../components/ui';
import BotonGoogle from '../components/BotonGoogle';
import { useTitulo } from '../lib/titulo';

export default function Entrar() {
  useTitulo('Entrar o crear cuenta');

  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login, registro } = useAuth();

  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '' });
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, string[]>>({});
  const [enviando, setEnviando] = useState(false);

  const volver = params.get('volver') ?? '/';

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetalles({});
    setEnviando(true);
    try {
      if (modo === 'login') {
        await login({ email: form.email, password: form.password });
      } else {
        await registro({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          ...(form.telefono && { telefono: form.telefono }),
        });
      }
      navigate(volver, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.detalles) setDetalles(err.detalles);
      } else {
        setError('No pudimos conectar. Revisa tu internet e intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center">
        <img src={MARCA.logoUrl} alt="" className="mx-auto h-16 w-16 object-contain" />
        <h1 className="mt-4 text-3xl">{modo === 'login' ? 'Bienvenida de nuevo' : 'Crea tu cuenta'}</h1>
        <p className="mt-2 text-sm text-suave">
          {modo === 'login'
            ? 'Entra para ver tus pedidos y pagar más rápido.'
            : 'Guarda tus direcciones y sigue tus pedidos.'}
        </p>
      </div>

      <form onSubmit={enviar} className="tarjeta mt-8 space-y-4 p-6">
        {modo === 'registro' && (
          <label className="block">
            <span className="etiqueta">Nombre</span>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="campo mt-2"
            />
            {detalles.nombre?.[0] && (
              <span className="mt-1 block text-xs text-acento">{detalles.nombre[0]}</span>
            )}
          </label>
        )}

        <label className="block">
          <span className="etiqueta">Correo</span>
          <input
            required
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="campo mt-2"
          />
          {detalles.email?.[0] && (
            <span className="mt-1 block text-xs text-acento">{detalles.email[0]}</span>
          )}
        </label>

        <label className="block">
          <span className="etiqueta">Contraseña</span>
          <input
            required
            type="password"
            autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="campo mt-2"
          />
          {detalles.password?.[0] && (
            <span className="mt-1 block text-xs text-acento">{detalles.password[0]}</span>
          )}
        </label>

        {modo === 'registro' && (
          <label className="block">
            <span className="etiqueta">Teléfono (opcional)</span>
            <input
              inputMode="tel"
              placeholder="9999-9999"
              value={form.telefono}
              onChange={(e) => setForm({ ...form, telefono: e.target.value })}
              className="campo mt-2"
            />
            {detalles.telefono?.[0] && (
              <span className="mt-1 block text-xs text-acento">{detalles.telefono[0]}</span>
            )}
          </label>
        )}

        {error && <Aviso>{error}</Aviso>}

        <button type="submit" disabled={enviando} className="btn-principal w-full">
          {enviando ? 'Un momento…' : modo === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>

        <BotonGoogle alEntrar={() => navigate(volver, { replace: true })} />

        {/* Solo al entrar: en el registro todavía no hay contraseña que olvidar. */}
        {modo === 'login' && (
          <p className="text-center text-sm">
            <Link to="/recuperar" className="text-suave underline hover:text-tinta">
              Olvidé mi contraseña
            </Link>
          </p>
        )}

        <p className="text-center text-sm text-suave">
          {modo === 'login' ? '¿Aún no tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button
            type="button"
            onClick={() => {
              setModo(modo === 'login' ? 'registro' : 'login');
              setError(null);
              setDetalles({});
            }}
            className="text-tinta underline"
          >
            {modo === 'login' ? 'Créala aquí' : 'Entra'}
          </button>
        </p>
      </form>

      <p className="mt-6 text-center text-xs text-suave">
        <Link to="/catalogo" className="hover:text-tinta">
          Seguir viendo el catálogo
        </Link>
      </p>
    </div>
  );
}
