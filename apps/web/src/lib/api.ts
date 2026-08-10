import type { AuthResponse } from '@gina/shared';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

const ACCESS = 'gina.accessToken';
const REFRESH = 'gina.refreshToken';

export const tokens = {
  access: () => localStorage.getItem(ACCESS),
  refresh: () => localStorage.getItem(REFRESH),
  guardar(a: string, r: string) {
    localStorage.setItem(ACCESS, a);
    localStorage.setItem(REFRESH, r);
  },
  borrar() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly detalles?: Record<string, string[]>,
  ) {
    super(message);
  }
}

/** Una sola renovación en vuelo: si tres peticiones caducan juntas, se comparte. */
let renovacionEnCurso: Promise<boolean> | null = null;

async function renovarSesion(): Promise<boolean> {
  const refreshToken = tokens.refresh();
  if (!refreshToken) return false;

  renovacionEnCurso ??= (async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        tokens.borrar();
        return false;
      }
      const data = (await res.json()) as AuthResponse;
      tokens.guardar(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Se libera en el microtask siguiente para que quien esperaba vea el valor.
      setTimeout(() => {
        renovacionEnCurso = null;
      }, 0);
    }
  })();

  return renovacionEnCurso;
}

interface Opciones {
  method?: string;
  body?: unknown;
  /** Reintentar tras renovar la sesión. Interno, evita bucles infinitos. */
  reintentar?: boolean;
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  const { method = 'GET', body, reintentar = true } = opciones;
  const headers: Record<string, string> = {};
  const access = tokens.access();
  if (access) headers.authorization = `Bearer ${access}`;
  if (body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`${BASE}/api${ruta}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  // El access token dura 15 min: al caducar se renueva y se repite la petición
  // una sola vez, sin que el usuario note nada.
  if (res.status === 401 && reintentar && tokens.refresh()) {
    if (await renovarSesion()) {
      return api<T>(ruta, { ...opciones, reintentar: false });
    }
  }

  if (res.status === 204) return undefined as T;

  const texto = await res.text();
  const data: unknown = texto ? JSON.parse(texto) : null;

  if (!res.ok) {
    const e = (data as { error?: { message?: string; code?: string; detalles?: Record<string, string[]> } })
      ?.error;
    throw new ApiError(
      res.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Algo salió mal, intenta de nuevo',
      e?.detalles,
    );
  }

  return data as T;
}
