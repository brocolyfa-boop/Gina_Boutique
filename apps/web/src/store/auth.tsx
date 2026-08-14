import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthResponse, LoginInput, RegistroInput, UserDTO } from '@gina/shared';
import { api, tokens } from '../lib/api';

interface AuthCtx {
  user: UserDTO | null;
  cargando: boolean;
  esAdmin: boolean;
  login: (datos: LoginInput) => Promise<void>;
  registro: (datos: RegistroInput) => Promise<void>;
  /** Entra con el token que devuelve el botón de Google. */
  entrarConGoogle: (credential: string) => Promise<void>;
  salir: () => Promise<void>;
  /** Reemplaza el usuario en memoria, p. ej. tras editar el perfil en Mi cuenta. */
  actualizarUsuario: (user: UserDTO) => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [cargando, setCargando] = useState(true);

  // Al abrir la web, si hay token guardado se recupera la sesión.
  useEffect(() => {
    if (!tokens.access()) {
      setCargando(false);
      return;
    }
    api<UserDTO>('/auth/me')
      .then(setUser)
      .catch(() => tokens.borrar())
      .finally(() => setCargando(false));
  }, []);

  // Los tres caminos de entrada (contraseña, registro y Google) guardan el
  // token igual: si cada uno lo hiciera por su cuenta, uno terminaría dejando
  // la sesión a medias.
  const entrar = useCallback(async (ruta: string, datos: unknown) => {
    const res = await api<AuthResponse>(ruta, { method: 'POST', body: datos });
    tokens.guardar(res.accessToken, res.refreshToken);
    setUser(res.user);
  }, []);

  const salir = useCallback(async () => {
    const refreshToken = tokens.refresh();
    if (refreshToken) {
      // Se revoca en el servidor, pero si falla la red igual cerramos local.
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
    tokens.borrar();
    setUser(null);
  }, []);

  const valor = useMemo<AuthCtx>(
    () => ({
      user,
      cargando,
      esAdmin: user?.rol === 'admin',
      login: (datos) => entrar('/auth/login', datos),
      registro: (datos) => entrar('/auth/registro', datos),
      entrarConGoogle: (credential) => entrar('/auth/google', { credential }),
      salir,
      actualizarUsuario: setUser,
    }),
    [user, cargando, entrar, salir],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
