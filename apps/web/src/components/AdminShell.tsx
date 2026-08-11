import { Link, NavLink, useNavigate } from 'react-router-dom';
import { MARCA } from '@gina/shared';
import { useAuth } from '../store/auth';

export const SECCIONES = [
  { clave: 'resumen', texto: 'Resumen' },
  { clave: 'pedidos', texto: 'Pedidos' },
  { clave: 'productos', texto: 'Productos' },
  { clave: 'categorias', texto: 'Categorías' },
  { clave: 'promociones', texto: 'Promociones' },
  { clave: 'clientes', texto: 'Clientes' },
] as const;

export type Seccion = (typeof SECCIONES)[number]['clave'];

/**
 * Cascarón del panel: cabecera propia, sin la tienda alrededor.
 *
 * El administrador no navega el catálogo desde aquí — para eso está el botón
 * "Ver como cliente", que lo saca a la tienda tal como la ve un comprador.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, salir } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-fondo">
      <header className="sticky top-0 z-20 border-b border-borde bg-white">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-8">
          <Link to="/admin" className="flex shrink-0 items-center gap-3">
            <span className="whitespace-nowrap font-display text-lg leading-none">
              {MARCA.nombre}
            </span>
            <span className="hidden border border-borde px-2 py-1 text-[10px] uppercase tracking-etiqueta text-suave sm:inline-block">
              Panel
            </span>
          </Link>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            <Link to="/" className="btn-secundario whitespace-nowrap px-3 py-2 text-[11px] sm:px-4 sm:text-xs">
              Ver como cliente
            </Link>
            {user && (
              <span className="hidden max-w-[10rem] truncate text-xs text-suave md:inline-block">
                {user.email}
              </span>
            )}
            <button
              onClick={async () => {
                await salir();
                navigate('/');
              }}
              className="text-xs uppercase tracking-etiqueta text-suave hover:text-tinta"
            >
              Salir
            </button>
          </div>
        </div>

        <nav className="border-t border-borde">
          <div className="mx-auto flex max-w-[90rem] gap-6 overflow-x-auto px-4 lg:px-8">
            {SECCIONES.map((s) => (
              <NavLink
                key={s.clave}
                to={`/admin/${s.clave}`}
                className={({ isActive }) =>
                  `-mb-px whitespace-nowrap border-b-2 py-3 text-xs uppercase tracking-etiqueta transition ${
                    isActive ? 'border-tinta text-tinta' : 'border-transparent text-suave hover:text-tinta'
                  }`
                }
              >
                {s.texto}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-8 lg:px-8">{children}</main>
    </div>
  );
}
