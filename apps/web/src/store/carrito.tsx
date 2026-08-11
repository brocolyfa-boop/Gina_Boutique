import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { CartDTO, CartItemInput, ConfigPublicaDTO, ProductoDTO } from '@gina/shared';
import { TARIFAS_ENVIO_FALLBACK, precioFinal, redondear } from '@gina/shared';
import { api } from '../lib/api';
import { useAuth } from './auth';

const CLAVE_INVITADO = 'gina.carritoInvitado';

/** Lo que guarda un invitado: la línea más lo necesario para pintarla. */
interface LineaInvitado extends CartItemInput {
  nombre: string;
  precioFinal: number;
  imagen: string | null;
  stock: number;
}

function leerInvitado(): LineaInvitado[] {
  try {
    const crudo = localStorage.getItem(CLAVE_INVITADO);
    return crudo ? (JSON.parse(crudo) as LineaInvitado[]) : [];
  } catch {
    return [];
  }
}

const guardarInvitado = (lineas: LineaInvitado[]) =>
  localStorage.setItem(CLAVE_INVITADO, JSON.stringify(lineas));

const mismaLinea = (a: CartItemInput, b: CartItemInput) =>
  a.productoId === b.productoId &&
  (a.talla ?? null) === (b.talla ?? null) &&
  (a.color ?? null) === (b.color ?? null);

interface CarritoCtx {
  carrito: CartDTO;
  costoEnvio: number;
  cargando: boolean;
  unidades: number;
  agregar: (producto: ProductoDTO, item: CartItemInput) => Promise<void>;
  cambiarCantidad: (indice: number, cantidad: number) => Promise<void>;
  quitar: (indice: number) => Promise<void>;
  vaciar: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const Ctx = createContext<CarritoCtx | null>(null);

const VACIO: CartDTO = { items: [], subtotal: 0, costoEnvio: 0, envioEstimado: false, total: 0 };

export function CarritoProvider({ children }: { children: ReactNode }) {
  const { user, cargando: cargandoAuth } = useAuth();
  const [carrito, setCarrito] = useState<CartDTO>(VACIO);
  const [costoEnvio, setCostoEnvio] = useState(
    Math.min(TARIFAS_ENVIO_FALLBACK.tegucigalpa, TARIFAS_ENVIO_FALLBACK.nacional),
  );
  const [cargando, setCargando] = useState(false);

  // El costo de envío lo manda el backend: así se puede cambiar sin recompilar.
  useEffect(() => {
    api<ConfigPublicaDTO>('/config')
      .then((c) => setCostoEnvio(c.costoEnvioLps))
      .catch(() => {});
  }, []);

  /** Reconstruye el carrito de invitado con los totales al día. */
  const pintarInvitado = useCallback(
    (lineas: LineaInvitado[], envio: number) => {
      const items = lineas.map((l) => ({
        id: null,
        productoId: l.productoId,
        cantidad: l.cantidad,
        talla: l.talla ?? null,
        color: l.color ?? null,
        producto: {
          nombre: l.nombre,
          precio: l.precioFinal,
          precioOferta: null,
          precioFinal: l.precioFinal,
          imagenes: l.imagen ? [l.imagen] : [],
          stock: l.stock,
        },
        totalLinea: redondear(l.precioFinal * l.cantidad),
      }));
      const subtotal = redondear(items.reduce((a, i) => a + i.totalLinea, 0));
      const envioReal = items.length > 0 ? envio : 0;
      setCarrito({
        items,
        subtotal,
        costoEnvio: envioReal,
        envioEstimado: items.length > 0,
        total: redondear(subtotal + envioReal),
      });
    },
    [],
  );

  const cargarDelServidor = useCallback(async () => {
    const data = await api<CartDTO>('/carrito');
    setCarrito(data);
    return data;
  }, []);

  /**
   * Invitado: se pinta desde localStorage. Depende de costoEnvio porque los
   * totales se calculan aquí, no en el servidor.
   */
  useEffect(() => {
    if (cargandoAuth || user) return;
    pintarInvitado(leerInvitado(), costoEnvio);
  }, [user, cargandoAuth, costoEnvio, pintarInvitado]);

  /**
   * Con sesión: se sube el carrito de invitado y se fusiona.
   *
   * Este efecto NO depende de costoEnvio a propósito. Antes sí, y provocaba una
   * carrera: cuando GET /config respondía, costoEnvio cambiaba, React cancelaba
   * el efecto en vuelo y lanzaba otro; el segundo leía el carrito del servidor
   * antes de que terminara el POST /sincronizar del primero, recibía vacío y
   * descartaba el resultado bueno. Resultado: el carrito se perdía al entrar.
   * Con sesión los totales los calcula el servidor, así que costoEnvio no pinta
   * nada aquí.
   */
  const usuarioSincronizado = useRef<string | null>(null);

  useEffect(() => {
    if (cargandoAuth || !user) {
      if (!user) usuarioSincronizado.current = null;
      return;
    }
    // Una sola sincronización por sesión iniciada.
    if (usuarioSincronizado.current === user.id) return;
    usuarioSincronizado.current = user.id;

    let cancelado = false;
    setCargando(true);
    (async () => {
      const pendientes = leerInvitado();
      try {
        if (pendientes.length > 0) {
          const items: CartItemInput[] = pendientes.map((l) => ({
            productoId: l.productoId,
            cantidad: l.cantidad,
            talla: l.talla ?? null,
            color: l.color ?? null,
          }));
          const res = await api<CartDTO>('/carrito/sincronizar', {
            method: 'POST',
            body: { items },
          });
          localStorage.removeItem(CLAVE_INVITADO);
          if (!cancelado) setCarrito(res);
        } else {
          const res = await api<CartDTO>('/carrito');
          if (!cancelado) setCarrito(res);
        }
      } catch {
        if (!cancelado) setCarrito(VACIO);
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [user, cargandoAuth]);

  const agregar = useCallback(
    async (producto: ProductoDTO, item: CartItemInput) => {
      if (user) {
        setCarrito(await api<CartDTO>('/carrito/items', { method: 'POST', body: item }));
        return;
      }
      // Invitado: mismo comportamiento que el servidor, sumar en vez de duplicar.
      const lineas = leerInvitado();
      const existente = lineas.find((l) => mismaLinea(l, item));
      if (existente) {
        existente.cantidad = Math.min(existente.cantidad + item.cantidad, producto.stock);
      } else {
        lineas.push({
          ...item,
          nombre: producto.nombre,
          precioFinal: precioFinal(producto.precio, producto.precioOferta),
          imagen: producto.imagenes[0] ?? null,
          stock: producto.stock,
        });
      }
      guardarInvitado(lineas);
      pintarInvitado(lineas, costoEnvio);
    },
    [user, costoEnvio, pintarInvitado],
  );

  const cambiarCantidad = useCallback(
    async (indice: number, cantidad: number) => {
      const linea = carrito.items[indice];
      if (!linea) return;

      // Cada línea trae su id del servidor; para el invitado es null y se busca
      // por producto + talla + color en el almacenamiento local.
      if (user && linea.id) {
        setCarrito(
          await api<CartDTO>(`/carrito/items/${linea.id}`, {
            method: 'PATCH',
            body: { cantidad },
          }),
        );
        return;
      }

      const lineas = leerInvitado();
      const objetivo = lineas.findIndex((l) => mismaLinea(l, linea));
      if (objetivo < 0) return;
      if (cantidad <= 0) lineas.splice(objetivo, 1);
      else lineas[objetivo]!.cantidad = cantidad;
      guardarInvitado(lineas);
      pintarInvitado(lineas, costoEnvio);
    },
    [carrito.items, user, costoEnvio, pintarInvitado],
  );

  const quitar = useCallback((indice: number) => cambiarCantidad(indice, 0), [cambiarCantidad]);

  const vaciar = useCallback(async () => {
    if (user) {
      setCarrito(await api<CartDTO>('/carrito', { method: 'DELETE' }));
    } else {
      localStorage.removeItem(CLAVE_INVITADO);
      pintarInvitado([], costoEnvio);
    }
  }, [user, costoEnvio, pintarInvitado]);

  const refrescar = useCallback(async () => {
    if (user) await cargarDelServidor();
    else pintarInvitado(leerInvitado(), costoEnvio);
  }, [user, cargarDelServidor, pintarInvitado, costoEnvio]);

  const valor = useMemo<CarritoCtx>(
    () => ({
      carrito,
      costoEnvio,
      cargando,
      unidades: carrito.items.reduce((a, i) => a + i.cantidad, 0),
      agregar,
      cambiarCantidad,
      quitar,
      vaciar,
      refrescar,
    }),
    [carrito, costoEnvio, cargando, agregar, cambiarCantidad, quitar, vaciar, refrescar],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useCarrito(): CarritoCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCarrito debe usarse dentro de CarritoProvider');
  return ctx;
}
