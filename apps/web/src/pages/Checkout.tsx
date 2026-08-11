import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { ConfigPublicaDTO, MetodoPago, OrdenDTO } from '@gina/shared';
import {
  DEPARTAMENTOS_HONDURAS,
  costoEnvioPara,
  enlaceWhatsApp,
  entregaEstimada,
  formatLps,
  redondear,
  resumenPedidoWhatsApp,
} from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { useCarrito } from '../store/carrito';
import { Aviso, Vacio } from '../components/ui';
import { useTitulo } from '../lib/titulo';

type ConfigConDetalle = ConfigPublicaDTO & {
  metodosPagoDetalle: Array<{ metodo: MetodoPago; etiqueta: string; descripcion: string }>;
};

export default function Checkout() {
  useTitulo('Finalizar compra');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { carrito, refrescar, vaciar } = useCarrito();

  const [form, setForm] = useState({
    nombreCompleto: '',
    telefonoContacto: '',
    departamento: '',
    municipio: '',
    direccionCompleta: '',
    referencia: '',
    notas: '',
    emailCliente: '',
  });
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, string[]>>({});
  const [enviando, setEnviando] = useState(false);
  const [orden, setOrden] = useState<OrdenDTO | null>(null);

  const { data: config } = useQuery({
    queryKey: ['config'],
    queryFn: () => api<ConfigConDetalle>('/config'),
  });

  // El nombre y el teléfono del perfil ahorran tecleo.
  useEffect(() => {
    if (!user) return;
    setForm((f) => ({
      ...f,
      nombreCompleto: f.nombreCompleto || user.nombre,
      telefonoContacto: f.telefonoContacto || (user.telefono ?? ''),
      emailCliente: f.emailCliente || user.email,
    }));
  }, [user]);

  // Se preselecciona el único método si solo hay uno disponible.
  useEffect(() => {
    const metodos = config?.metodosPagoDetalle;
    if (metodos?.length === 1 && metodos[0]) setMetodoPago(metodos[0].metodo);
  }, [config]);

  const entrega = useMemo(
    () => (form.departamento ? entregaEstimada(form.departamento) : null),
    [form.departamento],
  );

  /**
   * El envío depende de la zona, así que el total solo es definitivo cuando el
   * cliente ya eligió departamento y municipio. Antes de eso se muestra la
   * estimación que trae el carrito, marcada como tal.
   */
  const zonaCompleta = Boolean(form.departamento && form.municipio.trim());
  const envioCalculado = zonaCompleta && config
    ? costoEnvioPara(form.departamento, form.municipio, config.tarifasEnvio)
    : carrito.costoEnvio;
  const totalConEnvio = redondear(carrito.subtotal + envioCalculado);

  // El texto lo arma el paquete compartido, el mismo que usa el aviso del
  // servidor: así el mensaje del cliente y el nuestro dicen lo mismo.
  const enlacePedidoWhatsApp =
    orden && config?.whatsapp ? enlaceWhatsApp(config.whatsapp, resumenPedidoWhatsApp(orden)) : null;

  if (orden) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center lg:px-8">
        <p className="etiqueta">Pedido confirmado</p>
        <h1 className="mt-3 text-4xl">¡Gracias por tu compra!</h1>
        <p className="mt-4 text-sm text-suave">
          Tu número de pedido es <strong className="text-tinta">{orden.numero}</strong>. Te
          contactaremos al {orden.telefonoContacto} para coordinar la entrega.
        </p>

        <div className="marco-pago mt-10 text-left">
          <h2 className="text-lg">Resumen del pedido</h2>
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
                <span className="whitespace-nowrap">{formatLps(i.precioUnitario * i.cantidad)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-suave">Subtotal</dt>
              <dd>{formatLps(orden.subtotal)}</dd>
            </div>
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

        {enlacePedidoWhatsApp && (
          <p className="mt-8 text-sm text-suave">
            ¿Quieres confirmarlo de una vez?{' '}
            <a
              href={enlacePedidoWhatsApp}
              target="_blank"
              rel="noreferrer"
              className="text-tinta underline"
            >
              Envíanos el pedido por WhatsApp
            </a>
            .
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          {orden.esInvitado ? (
            <Link to={`/seguimiento?numero=${orden.numero}`} className="btn-principal">
              Seguir mi pedido
            </Link>
          ) : (
            <Link to="/mis-pedidos" className="btn-principal">
              Ver mis pedidos
            </Link>
          )}
          <Link to="/catalogo" className="btn-secundario">
            Seguir comprando
          </Link>
        </div>

        {orden.esInvitado && (
          <p className="mt-4 text-xs text-suave">
            Guarda tu número de pedido: con él y tu teléfono puedes consultarlo cuando quieras,
            sin necesidad de crear una cuenta.
          </p>
        )}
      </div>
    );
  }

  if (carrito.items.length === 0) {
    return (
      <Vacio
        titulo="No hay nada que pagar"
        texto="Agrega productos a tu carrito para continuar."
        accion={
          <Link to="/catalogo" className="btn-principal">
            Ver catálogo
          </Link>
        }
      />
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetalles({});
    if (!metodoPago) return setError('Elige un método de pago');

    setEnviando(true);
    try {
      const creada = await api<OrdenDTO>('/ordenes', {
        method: 'POST',
        body: {
          items: carrito.items.map((i) => ({
            productoId: i.productoId,
            cantidad: i.cantidad,
            talla: i.talla,
            color: i.color,
          })),
          envio: {
            nombreCompleto: form.nombreCompleto,
            telefonoContacto: form.telefonoContacto,
            departamento: form.departamento,
            municipio: form.municipio,
            direccionCompleta: form.direccionCompleta,
            ...(form.referencia && { referencia: form.referencia }),
          },
          metodoPago,
          ...(form.notas && { notas: form.notas }),
          ...(form.emailCliente && { emailCliente: form.emailCliente }),
        },
      });
      // El invitado no tiene carrito en el servidor: el suyo vive en el
      // navegador y hay que borrarlo aquí, o seguiría lleno tras comprar.
      if (user) await refrescar();
      else await vaciar();
      setOrden(creada);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.detalles) setDetalles(err.detalles);
      } else {
        setError('No se pudo completar el pedido. Intenta de nuevo.');
      }
    } finally {
      setEnviando(false);
    }
  };

  const campo = (nombre: keyof typeof form) => detalles[`envio.${nombre}`]?.[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
      <h1 className="text-3xl">Finalizar compra</h1>

      {!user && (
        <p className="mt-3 text-sm text-suave">
          No necesitas cuenta para comprar. Si ya tienes una,{' '}
          <Link to="/entrar?volver=/checkout" className="text-tinta underline">
            entra aquí
          </Link>{' '}
          y se llenan tus datos solos.
        </p>
      )}

      <form onSubmit={enviar} className="mt-8 grid gap-12 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-10">
          <section>
            <h2 className="text-lg">1. Datos de envío</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="etiqueta">Nombre completo</span>
                <input
                  required
                  value={form.nombreCompleto}
                  onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
                  className="campo mt-2"
                />
                {campo('nombreCompleto') && (
                  <span className="mt-1 block text-xs text-acento">{campo('nombreCompleto')}</span>
                )}
              </label>

              <label>
                <span className="etiqueta">Teléfono</span>
                <input
                  required
                  inputMode="tel"
                  placeholder="9999-9999"
                  value={form.telefonoContacto}
                  onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
                  className="campo mt-2"
                />
                {campo('telefonoContacto') && (
                  <span className="mt-1 block text-xs text-acento">{campo('telefonoContacto')}</span>
                )}
              </label>

              <label>
                <span className="etiqueta">Departamento</span>
                <select
                  required
                  value={form.departamento}
                  onChange={(e) => setForm({ ...form, departamento: e.target.value })}
                  className="campo mt-2"
                >
                  <option value="">Elige…</option>
                  {DEPARTAMENTOS_HONDURAS.map((d) => (
                    <option key={d.nombre} value={d.nombre}>
                      {d.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span className="etiqueta">Municipio</span>
                <input
                  required
                  value={form.municipio}
                  onChange={(e) => setForm({ ...form, municipio: e.target.value })}
                  className="campo mt-2"
                />
              </label>

              <label className="sm:col-span-2">
                <span className="etiqueta">Dirección</span>
                <input
                  required
                  placeholder="Colonia, calle, número de casa"
                  value={form.direccionCompleta}
                  onChange={(e) => setForm({ ...form, direccionCompleta: e.target.value })}
                  className="campo mt-2"
                />
                {campo('direccionCompleta') && (
                  <span className="mt-1 block text-xs text-acento">{campo('direccionCompleta')}</span>
                )}
              </label>

              <label className="sm:col-span-2">
                <span className="etiqueta">Correo (opcional)</span>
                <input
                  type="email"
                  placeholder="Para enviarte la confirmación"
                  value={form.emailCliente}
                  onChange={(e) => setForm({ ...form, emailCliente: e.target.value })}
                  className="campo mt-2"
                />
                {detalles.emailCliente?.[0] && (
                  <span className="mt-1 block text-xs text-acento">{detalles.emailCliente[0]}</span>
                )}
              </label>

              <label className="sm:col-span-2">
                <span className="etiqueta">Referencia (opcional)</span>
                <input
                  placeholder="Portón negro, frente a la pulpería"
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  className="campo mt-2"
                />
              </label>
            </div>

            {entrega && (
              <p className="mt-4 text-sm text-suave">
                Entrega a {form.departamento}:{' '}
                <strong className="text-tinta">
                  {entrega.diasMin} a {entrega.diasMax} días hábiles
                </strong>
                {zonaCompleta && config && (
                  <>
                    {' · Envío '}
                    <strong className="text-tinta">{formatLps(envioCalculado)}</strong>
                    {envioCalculado === config.tarifasEnvio.tegucigalpa
                      ? ' (dentro de Tegucigalpa)'
                      : ' (nacional)'}
                  </>
                )}
                .
              </p>
            )}
          </section>

          {/*
            El marco blanco del pago: fondo blanco, borde y sombra suave. Sobre el
            blanco roto de la página, se separa por elevación y no por color, que
            es lo coherente con una marca blanca.
          */}
          <section>
            <h2 className="text-lg">2. Método de pago</h2>
            <div className="marco-pago mt-5">
              <div className="space-y-3">
                {config?.metodosPagoDetalle.map((m) => (
                  <label
                    key={m.metodo}
                    className={`flex cursor-pointer items-start gap-3 border p-4 transition ${
                      metodoPago === m.metodo ? 'border-tinta' : 'border-borde hover:border-suave'
                    }`}
                  >
                    <input
                      type="radio"
                      name="metodoPago"
                      value={m.metodo}
                      checked={metodoPago === m.metodo}
                      onChange={() => setMetodoPago(m.metodo)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">{m.etiqueta}</span>
                      <span className="mt-1 block text-xs text-suave">{m.descripcion}</span>
                    </span>
                  </label>
                ))}
              </div>

              {config && config.metodosPagoDetalle.length === 1 && (
                <p className="mt-4 text-xs text-suave">
                  El pago con tarjeta estará disponible próximamente.
                </p>
              )}

              <label className="mt-6 block">
                <span className="etiqueta">Nota para el pedido (opcional)</span>
                <textarea
                  rows={3}
                  value={form.notas}
                  onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  className="campo mt-2 resize-none"
                />
              </label>
            </div>
          </section>

          {error && <Aviso>{error}</Aviso>}
        </div>

        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="tarjeta p-6">
            <h2 className="text-lg">Tu pedido</h2>
            <ul className="mt-4 divide-y divide-borde">
              {carrito.items.map((i) => (
                <li key={i.id ?? i.productoId} className="flex justify-between gap-3 py-3 text-sm">
                  <span>
                    {i.cantidad} × {i.producto?.nombre}
                    {[i.talla, i.color].filter(Boolean).length > 0 && (
                      <span className="block text-xs text-suave">
                        {[i.talla, i.color].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                  <span className="whitespace-nowrap">{formatLps(i.totalLinea)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-suave">Subtotal</dt>
                <dd>{formatLps(carrito.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-suave">
                  Envío
                  {!zonaCompleta && <span className="block text-xs">estimado</span>}
                </dt>
                <dd>{formatLps(envioCalculado)}</dd>
              </div>
              <div className="flex justify-between border-t border-borde pt-2 text-base font-medium">
                <dt>Total</dt>
                <dd>{formatLps(totalConEnvio)}</dd>
              </div>
            </dl>

            <button type="submit" disabled={enviando} className="btn-principal mt-6 w-full">
              {enviando ? 'Procesando…' : 'Confirmar pedido'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/carrito')}
              className="mt-3 w-full text-xs uppercase tracking-etiqueta text-suave hover:text-tinta"
            >
              Volver al carrito
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
}
