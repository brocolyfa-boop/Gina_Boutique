import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { OrdenDTO, PromocionDTO, UserDTO } from '@gina/shared';
import { MARCA, enlaceWhatsApp, formatLps } from '@gina/shared';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../store/auth';
import { Aviso, Skeleton, Vacio } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/** Forma real de una dirección: la API la devuelve tal cual sale de Prisma. */
interface DireccionDTO {
  id: string;
  alias: string;
  nombreCompleto: string;
  telefonoContacto: string;
  direccionCompleta: string;
  departamento: string;
  municipio: string;
  referencia: string | null;
  esPrincipal: boolean;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function desde(fecha: string): string {
  const d = new Date(fecha);
  return `${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Tarjeta de resumen con etiqueta arriba y número grande, igual en las tres. */
function Tile({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="tarjeta p-5">
      <p className="etiqueta">{etiqueta}</p>
      <p className="mt-2 text-2xl">{valor}</p>
    </div>
  );
}

function SeccionDatos({ user }: { user: UserDTO }) {
  const { actualizarUsuario } = useAuth();
  const [nombre, setNombre] = useState(user.nombre);
  const [telefono, setTelefono] = useState(user.telefono ?? '');
  const [direccion, setDireccion] = useState(user.direccion ?? '');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const guardar = useMutation({
    mutationFn: () =>
      api<UserDTO>('/auth/me', {
        method: 'PATCH',
        body: { nombre, telefono: telefono || undefined, direccion: direccion || undefined },
      }),
    onSuccess: (u) => {
      actualizarUsuario(u);
      setOk(true);
      setError(null);
      setTimeout(() => setOk(false), 2500);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo guardar'),
  });

  return (
    <section className="tarjeta p-6">
      <h2 className="text-lg">Mis datos</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar.mutate();
        }}
        className="mt-5 grid gap-4 sm:grid-cols-2"
      >
        <label className="sm:col-span-2">
          <span className="etiqueta">Nombre</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="campo mt-2" />
        </label>
        <label>
          <span className="etiqueta">Correo</span>
          <input value={user.email} disabled className="campo mt-2 opacity-60" />
        </label>
        <label>
          <span className="etiqueta">Teléfono</span>
          <input
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            placeholder="9999-9999"
            className="campo mt-2"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="etiqueta">Dirección</span>
          <input
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className="campo mt-2"
          />
        </label>

        {error && (
          <div className="sm:col-span-2">
            <Aviso>{error}</Aviso>
          </div>
        )}
        {ok && (
          <div className="sm:col-span-2">
            <Aviso tipo="ok">Guardado.</Aviso>
          </div>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={guardar.isPending} className="btn-principal">
            {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </section>
  );
}

function SeccionSeguridad() {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const cambiar = useMutation({
    mutationFn: () => api('/auth/password', { method: 'PATCH', body: { actual, nueva } }),
    onSuccess: () => {
      setOk(true);
      setError(null);
      setActual('');
      setNueva('');
      setTimeout(() => setOk(false), 2500);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo cambiar la contraseña'),
  });

  return (
    <section className="tarjeta p-6">
      <h2 className="text-lg">Seguridad</h2>
      <p className="mt-1 text-sm text-suave">Cambia tu contraseña cuando quieras.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          cambiar.mutate();
        }}
        className="mt-5 grid gap-4 sm:grid-cols-2"
      >
        <label>
          <span className="etiqueta">Contraseña actual</span>
          <input
            type="password"
            required
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            className="campo mt-2"
          />
        </label>
        <label>
          <span className="etiqueta">Contraseña nueva</span>
          <input
            type="password"
            required
            minLength={8}
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            className="campo mt-2"
          />
        </label>

        {error && (
          <div className="sm:col-span-2">
            <Aviso>{error}</Aviso>
          </div>
        )}
        {ok && (
          <div className="sm:col-span-2">
            <Aviso tipo="ok">Contraseña actualizada.</Aviso>
          </div>
        )}

        <div className="sm:col-span-2">
          <button type="submit" disabled={cambiar.isPending} className="btn-secundario">
            {cambiar.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </section>
  );
}

function SeccionDescuentos() {
  const { data, isLoading } = useQuery({
    queryKey: ['promociones-vigentes'],
    queryFn: () => api<PromocionDTO[]>('/promociones'),
  });

  return (
    <section className="tarjeta p-6">
      <h2 className="text-lg">Mis descuentos</h2>
      {isLoading ? (
        <Skeleton className="mt-4 h-16 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-sm text-suave">
          Por ahora no hay descuentos activos. Cuando haya una promoción vigente, aparecerá aquí y
          en el catálogo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-borde">
          {data.map((p) => (
            <li key={p.id} className="py-3">
              <p className="text-sm font-medium">{p.titulo}</p>
              <p className="mt-1 text-xs text-suave">
                {p.tipo === 'porcentaje' ? `${p.valor}% de descuento` : `${formatLps(p.valor)} de descuento`}
                {' · válida hasta '}
                {new Date(p.fechaFin).toLocaleDateString('es-HN')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SeccionDirecciones() {
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    alias: '',
    nombreCompleto: '',
    telefonoContacto: '',
    departamento: '',
    municipio: '',
    direccionCompleta: '',
  });
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['direcciones'],
    queryFn: () => api<DireccionDTO[]>('/direcciones'),
  });

  const crear = useMutation({
    mutationFn: () => api<DireccionDTO>('/direcciones', { method: 'POST', body: form }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['direcciones'] });
      setAbierto(false);
      setForm({
        alias: '',
        nombreCompleto: '',
        telefonoContacto: '',
        departamento: '',
        municipio: '',
        direccionCompleta: '',
      });
      setError(null);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'No se pudo guardar la dirección'),
  });

  const eliminar = useMutation({
    mutationFn: (id: string) => api(`/direcciones/${id}`, { method: 'DELETE' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['direcciones'] }),
  });

  return (
    <section className="tarjeta p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg">Mis direcciones</h2>
        {!abierto && (
          <button onClick={() => setAbierto(true)} className="text-xs uppercase tracking-etiqueta text-tinta underline">
            Agregar
          </button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-16 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-sm text-suave">Todavía no guardas ninguna dirección.</p>
      ) : (
        <ul className="mt-4 divide-y divide-borde">
          {data.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {d.alias}
                  {d.esPrincipal && <span className="ml-2 text-xs text-suave">(principal)</span>}
                </p>
                <p className="mt-1 text-xs text-suave">
                  {d.direccionCompleta}, {d.municipio}, {d.departamento}
                </p>
              </div>
              <button
                onClick={() => eliminar.mutate(d.id)}
                disabled={eliminar.isPending}
                className="shrink-0 text-xs text-suave hover:text-acento"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
          className="mt-5 grid gap-4 border-t border-borde pt-5 sm:grid-cols-2"
        >
          <label>
            <span className="etiqueta">Alias</span>
            <input
              required
              placeholder="Casa, trabajo…"
              value={form.alias}
              onChange={(e) => setForm({ ...form, alias: e.target.value })}
              className="campo mt-2"
            />
          </label>
          <label>
            <span className="etiqueta">Nombre de quien recibe</span>
            <input
              required
              value={form.nombreCompleto}
              onChange={(e) => setForm({ ...form, nombreCompleto: e.target.value })}
              className="campo mt-2"
            />
          </label>
          <label>
            <span className="etiqueta">Teléfono</span>
            <input
              required
              value={form.telefonoContacto}
              onChange={(e) => setForm({ ...form, telefonoContacto: e.target.value })}
              className="campo mt-2"
            />
          </label>
          <label>
            <span className="etiqueta">Departamento</span>
            <input
              required
              value={form.departamento}
              onChange={(e) => setForm({ ...form, departamento: e.target.value })}
              className="campo mt-2"
            />
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
              value={form.direccionCompleta}
              onChange={(e) => setForm({ ...form, direccionCompleta: e.target.value })}
              className="campo mt-2"
            />
          </label>

          {error && (
            <div className="sm:col-span-2">
              <Aviso>{error}</Aviso>
            </div>
          )}

          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" disabled={crear.isPending} className="btn-principal">
              {crear.isPending ? 'Guardando…' : 'Guardar dirección'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="btn-secundario">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function MiCuenta() {
  useTitulo('Mi cuenta');
  const { user, salir } = useAuth();

  const { data: ordenes, isLoading: cargandoOrdenes } = useQuery({
    queryKey: ['mis-ordenes'],
    queryFn: () => api<OrdenDTO[]>('/ordenes'),
    enabled: !!user,
  });

  if (!user) {
    return (
      <Vacio
        titulo="Inicia sesión"
        texto="Necesitas tu cuenta para ver tu perfil."
        accion={
          <Link to="/entrar?volver=/mi-cuenta" className="btn-principal">
            Entrar
          </Link>
        }
      />
    );
  }

  const activos = ordenes?.filter((o) => o.estado !== 'cancelado') ?? [];
  const totalComprado = activos
    .filter((o) => o.estado === 'entregado' || o.estado === 'pagado' || o.estado === 'enviado')
    .reduce((a, o) => a + o.total, 0);
  const enCamino = activos.filter((o) => o.estado === 'pagado' || o.estado === 'enviado').length;
  const recientes = (ordenes ?? []).slice(0, 3);

  const numeroWhatsApp = MARCA.redes.whatsapp;
  const enlaceAyuda = enlaceWhatsApp(numeroWhatsApp, 'Hola, tengo una consulta sobre mi cuenta.');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="etiqueta">Mi cuenta</p>
          <h1 className="mt-1 text-3xl">Hola, {user.nombre.split(' ')[0]}</h1>
          <p className="mt-2 text-sm text-suave">
            {user.email} · Cliente desde {desde(user.createdAt)}
          </p>
        </div>
        <button
          onClick={() => void salir()}
          className="text-xs uppercase tracking-etiqueta text-suave hover:text-tinta"
        >
          Cerrar sesión
        </button>
      </div>

      {cargandoOrdenes ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Tile etiqueta="Pedidos" valor={String(activos.length)} />
          <Tile etiqueta="Total comprado" valor={formatLps(totalComprado)} />
          <Tile etiqueta="En camino" valor={String(enCamino)} />
        </div>
      )}

      <div className="mt-10 space-y-8">
        <SeccionDatos user={user} />
        <SeccionSeguridad />
        <SeccionDescuentos />

        <section className="tarjeta p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg">Mis pedidos</h2>
            <Link to="/mis-pedidos" className="text-xs uppercase tracking-etiqueta text-tinta underline">
              Ver todos
            </Link>
          </div>
          {recientes.length === 0 ? (
            <p className="mt-3 text-sm text-suave">Todavía no tienes pedidos.</p>
          ) : (
            <ul className="mt-4 divide-y divide-borde">
              {recientes.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <div>
                    <p className="font-medium">{o.numero}</p>
                    <p className="mt-1 text-xs text-suave">{o.estado.replace(/_/g, ' ')}</p>
                  </div>
                  <p>{formatLps(o.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SeccionDirecciones />

        <section className="tarjeta p-6 text-sm text-suave">
          <h2 className="text-lg text-tinta">¿Necesitas ayuda?</h2>
          <p className="mt-3">
            <Link to="/politicas/cambios-y-devoluciones" className="text-tinta underline">
              Cambios y devoluciones
            </Link>
            {' · '}
            <Link to="/seguimiento" className="text-tinta underline">
              Seguir un pedido
            </Link>
            {enlaceAyuda && (
              <>
                {' · '}
                <a href={enlaceAyuda} target="_blank" rel="noreferrer" className="text-tinta underline">
                  Escribirnos por WhatsApp
                </a>
              </>
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
