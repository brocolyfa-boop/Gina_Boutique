import { Link } from 'react-router-dom';
import { formatLps } from '@gina/shared';
import { useCarrito } from '../store/carrito';
import { Imagen, Vacio } from '../components/ui';

export default function Carrito() {
  const { carrito, cambiarCantidad, quitar, vaciar } = useCarrito();

  if (carrito.items.length === 0) {
    return (
      <Vacio
        titulo="Tu carrito está vacío"
        texto="Cuando agregues algo aparecerá aquí, junto con el costo de envío."
        accion={
          <Link to="/catalogo" className="btn-principal">
            Ver catálogo
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl">Tu carrito</h1>

      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y divide-borde border-y border-borde">
          {carrito.items.map((item, i) => (
            <li key={item.id ?? `${item.productoId}-${item.talla}-${item.color}`} className="flex gap-4 py-6">
              <Link to={`/producto/${item.productoId}`} className="w-24 shrink-0">
                <Imagen src={item.producto?.imagenes[0]} alt={item.producto?.nombre ?? ''} />
              </Link>

              <div className="flex flex-1 flex-col">
                <div className="flex justify-between gap-4">
                  <div>
                    <Link to={`/producto/${item.productoId}`} className="text-sm hover:underline">
                      {item.producto?.nombre ?? 'Producto'}
                    </Link>
                    <p className="mt-1 text-xs text-suave">
                      {[item.talla && `Talla ${item.talla}`, item.color].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-sm font-medium">{formatLps(item.totalLinea)}</p>
                </div>

                <div className="mt-auto flex items-center gap-4 pt-4">
                  <div className="flex items-center border border-borde">
                    <button
                      onClick={() => void cambiarCantidad(i, item.cantidad - 1)}
                      aria-label="Quitar uno"
                      className="px-3 py-2 leading-none hover:bg-fondo"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">{item.cantidad}</span>
                    <button
                      onClick={() => void cambiarCantidad(i, item.cantidad + 1)}
                      disabled={!!item.producto && item.cantidad >= item.producto.stock}
                      aria-label="Agregar uno"
                      className="px-3 py-2 leading-none hover:bg-fondo disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => void quitar(i)}
                    className="text-xs uppercase tracking-etiqueta text-suave hover:text-acento"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="tarjeta p-6">
            <h2 className="text-lg">Resumen</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-suave">Subtotal</dt>
                <dd>{formatLps(carrito.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-suave">
                  Envío
                  {carrito.envioEstimado && <span className="block text-xs">desde</span>}
                </dt>
                <dd>{formatLps(carrito.costoEnvio)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-3 text-base font-medium">
                <dt>Total</dt>
                <dd>{formatLps(carrito.total)}</dd>
              </div>
            </dl>

            {carrito.envioEstimado && (
              <p className="mt-3 text-xs text-suave">
                El envío final depende de tu zona: se calcula al elegir departamento y municipio.
              </p>
            )}

            <Link to="/checkout" className="btn-principal mt-6 w-full">
              Continuar
            </Link>

            <div className="mt-4 flex justify-between text-xs">
              <Link to="/catalogo" className="text-suave hover:text-tinta">
                Seguir comprando
              </Link>
              <button onClick={() => void vaciar()} className="text-suave hover:text-acento">
                Vaciar carrito
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
