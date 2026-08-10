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
  salir: () => Promise<void>;
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

  const entrar = useCallback(async (ruta: string, datos: LoginInput | RegistroInput) => {
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
      salir,
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
