import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { CategoriaDTO } from '@gina/shared';
import { MARCA, enlaceWhatsApp } from '@gina/shared';
import { api } from '../lib/api';
import { useAuth } from '../store/auth';
import BotonWhatsApp from './BotonWhatsApp';
import { useCarrito } from '../store/carrito';

interface Sugerencia {
  id: string;
  nombre: string;
  imagen: string | null;
}

function Buscador() {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const navigate = useNavigate();
  const contenedor = useRef<HTMLFormElement>(null);

  // Autocompletado con espera de 250 ms: no se dispara una petición por tecla.
  useEffect(() => {
    if (texto.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    const id = setTimeout(() => {
      api<Sugerencia[]>(`/productos/sugerencias?q=${encodeURIComponent(texto.trim())}`)
        .then((s) => {
          setSugerencias(s);
          setAbierto(true);
        })
        .catch(() => setSugerencias([]));
    }, 250);
    return () => clearTimeout(id);
  }, [texto]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  return (
    <form
      ref={contenedor}
      className="relative w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        setAbierto(false);
        navigate(`/catalogo?q=${encodeURIComponent(texto.trim())}`);
      }}
    >
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => sugerencias.length > 0 && setAbierto(true)}
        placeholder="Buscar vestidos, tenis, bolsos…"
        aria-label="Buscar productos"
        className="campo py-2"
      />
      {abierto && sugerencias.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 border border-borde bg-white shadow-marco">
          {sugerencias.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setTexto('');
                  navigate(`/producto/${s.id}`);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-fondo"
              >
                {s.imagen && <img src={s.imagen} alt="" className="h-10 w-8 object-cover" />}
                <span>{s.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function Layout() {
  const { user, esAdmin, salir } = useAuth();
  const { unidades } = useCarrito();
  const navigate = useNavigate();

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api<CategoriaDTO[]>('/categorias'),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="flex min-h-screen flex-col">
      {/* Franja de envío: lo primero que un cliente en Honduras quiere saber. */}
      <div className="bg-tinta py-2 text-center text-[11px] uppercase tracking-etiqueta text-white">
        Envíos a los 18 departamentos · Entrega en 1 a 2 días
      </div>

      <header className="sticky top-0 z-20 border-b border-borde bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4 lg:gap-6 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-3">
            <img src={MARCA.logoUrl} alt="" className="h-10 w-10 object-contain" />
            <span className="whitespace-nowrap font-display text-lg leading-none sm:text-xl">
              {MARCA.nombre}
            </span>
          </Link>

          <nav className="hidden min-w-0 flex-1 items-center gap-6 overflow-hidden lg:flex">
            {categorias?.map((c) => (
              <NavLink
                key={c.id}
                to={`/catalogo?categoria=${c.slug}`}
                className="text-xs uppercase tracking-etiqueta text-suave transition hover:text-tinta"
              >
                {c.nombre}
              </NavLink>
            ))}
            <NavLink
              to="/catalogo?enOferta=true"
              className="text-xs uppercase tracking-etiqueta text-acento"
            >
              Ofertas
            </NavLink>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            <div className="hidden md:block">
              <Buscador />
            </div>

            {user ? (
              <div className="flex items-center gap-3 text-xs uppercase tracking-etiqueta">
                {/*
                  El nombre se oculta en móvil y se trunca en pantallas medianas:
                  un nombre largo empujaba la fila del header fuera de la
                  pantalla en 390 px. El enlace sigue accesible desde "Carrito"
                  y el menú de cuenta.
                */}
                <Link
                  to="/mis-pedidos"
                  className="hidden max-w-[7rem] truncate hover:underline sm:inline-block"
                >
                  {user.nombre.split(' ')[0]}
                </Link>
                {esAdmin && (
                  <Link to="/admin" className="border border-tinta px-3 py-1 hover:bg-tinta hover:text-white">
                    Panel
                  </Link>
                )}
                <button
                  onClick={async () => {
                    await salir();
                    navigate('/');
                  }}
                  className="text-suave hover:text-tinta"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link to="/entrar" className="text-xs uppercase tracking-etiqueta hover:underline">
                Entrar
              </Link>
            )}

            <Link to="/carrito" className="relative text-xs uppercase tracking-etiqueta">
              Carrito
              {unidades > 0 && (
                <span className="absolute -right-3 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-acento text-[10px] text-white">
                  {unidades}
                </span>
              )}
            </Link>
          </div>
        </div>

        <div className="border-t border-borde px-4 py-2 md:hidden">
          <Buscador />
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <BotonWhatsApp />

      <footer className="mt-24 border-t border-borde bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
          <div>
            <p className="font-display text-lg">{MARCA.nombre}</p>
            <p className="mt-2 text-sm text-suave">{MARCA.tagline}</p>

            <ul className="mt-4 space-y-2 text-sm">
              {MARCA.redes.instagram && (
                <li>
                  <a
                    href={MARCA.redes.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="text-suave hover:text-tinta"
                  >
                    Instagram @ginaboutique200
                  </a>
                </li>
              )}
              {/* Facebook solo aparece cuando hay enlace: un botón que no lleva
                  a la página correcta es peor que no tenerlo. */}
              {MARCA.redes.facebook && (
                <li>
                  <a
                    href={MARCA.redes.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="text-suave hover:text-tinta"
                  >
                    Facebook
                  </a>
                </li>
              )}
              <li>
                <a
                  href={
                    enlaceWhatsApp(
                      MARCA.redes.whatsapp,
                      `Hola ${MARCA.nombre}, me interesa un producto.`,
                    ) ?? '#'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-suave hover:text-tinta"
                >
                  WhatsApp {MARCA.redes.whatsapp}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="etiqueta">Categorías</p>
            <ul className="mt-3 space-y-2 text-sm">
              {categorias?.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link to={`/catalogo?categoria=${c.slug}`} className="text-suave hover:text-tinta">
                    {c.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="etiqueta">Envíos</p>
            <p className="mt-3 text-sm text-suave">
              Cobertura en los 18 departamentos de Honduras, con entrega de 1 a 2 días. El
              costo depende de la zona y se calcula al elegir tu departamento y municipio.
            </p>
          </div>
          <div>
            <p className="etiqueta">Ayuda</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/politicas/cambios-y-devoluciones" className="text-suave hover:text-tinta">
                  Cambios y devoluciones
                </Link>
              </li>
              <li>
                <Link to="/seguimiento" className="text-suave hover:text-tinta">
                  Seguir mi pedido
                </Link>
              </li>
              <li>
                <Link to="/politicas/terminos" className="text-suave hover:text-tinta">
                  Términos y condiciones
                </Link>
              </li>
              <li>
                <Link to="/politicas/privacidad" className="text-suave hover:text-tinta">
                  Aviso de privacidad
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="etiqueta">Pagos</p>
            <p className="mt-3 text-sm text-suave">
              Pago contra entrega disponible en todo el país. No necesitas cuenta para comprar.
            </p>
          </div>
        </div>
        <div className="border-t border-borde py-6 text-center text-xs text-suave">
          © {new Date().getFullYear()} {MARCA.nombre}
        </div>
      </footer>
    </div>
  );
}
