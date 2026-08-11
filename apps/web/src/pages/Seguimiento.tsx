import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { OrdenDTO } from '@gina/shared';
import { formatLps } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { Aviso } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/**
 * Consulta de un pedido sin cuenta: número más teléfono.
 *
 * Existe porque ahora se puede comprar como invitado, y un comprador que no se
 * registró también tiene derecho a saber en qué va su pedido.
 */
export default function Seguimiento() {
  useTitulo('Seguir mi pedido');

  const [params] = useSearchParams();
  const [numero, setNumero] = useState(params.get('numero') ?? '');
  const [telefono, setTelefono] = useState('');
  const [orden, setOrden] = useState<OrdenDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrden(null);
    setBuscando(true);
    try {
      setOrden(
        await api<OrdenDTO>(
          `/ordenes/seguimiento/${encodeURIComponent(numero.trim())}?telefono=${encodeURIComponent(
            telefono.trim(),
          )}`,
        ),
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No pudimos consultar el pedido. Intenta de nuevo.',
      );
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 lg:px-8">
      <h1 className="text-3xl">Seguir mi pedido</h1>
      <p className="mt-3 text-sm text-suave">
        Escribe el número que te dimos al comprar y el teléfono con el que hiciste el pedido.
      </p>

      <form onSubmit={buscar} className="tarjeta mt-8 space-y-4 p-6">
        <label className="block">
          <span className="etiqueta">Número de pedido</span>
          <input
            required
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="GB-000123"
            className="campo mt-2"
          />
        </label>
        <label className="block">
          <span className="etiqueta">Teléfono</span>
          <input
            required
            inputMode="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="9999-9999"
            className="campo mt-2"
          />
        </label>
        {error && <Aviso>{error}</Aviso>}
        <button type="submit" disabled={buscando} className="btn-principal w-full">
          {buscando ? 'Buscando…' : 'Consultar'}
        </button>
      </form>

      {orden && (
        <div className="marco-pago mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg">Pedido {orden.numero}</h2>
            <span className="etiqueta">{orden.estado.replace(/_/g, ' ')}</span>
          </div>

          <ul className="mt-5 divide-y divide-borde">
            {orden.items.map((i, idx) => (
              <li key={idx} className="flex justify-between gap-4 py-3 text-sm">
                <span>
                  {i.cantidad} × {i.nombre}
                  {[i.talla, i.color].filter(Boolean).length > 0 && (
                    <span className="block text-xs text-suave">
                      {[i.talla, i.color].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap">
                  {formatLps(i.precioUnitario * i.cantidad)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-suave">Envío</dt>
              <dd>{formatLps(orden.costoEnvio)}</dd>
            </div>
            <div className="flex justify-between text-base font-medium">
              <dt>Total</dt>
              <dd>{formatLps(orden.total)}</dd>
            </div>
          </dl>

          <p className="mt-5 border-t border-borde pt-4 text-sm text-suave">
            Envío a {orden.municipio}, {orden.departamento}. Entrega estimada:{' '}
            {orden.entregaEstimadaDias.min} a {orden.entregaEstimadaDias.max} días hábiles.
          </p>
        </div>
      )}

      <p className="mt-8 text-sm text-suave">
        <Link to="/catalogo" className="text-tinta underline">
          Volver al catálogo
        </Link>
      </p>
    </div>
  );
}
