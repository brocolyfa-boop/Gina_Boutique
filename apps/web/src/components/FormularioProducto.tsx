import { useEffect, useRef, useState } from 'react';
import type { CategoriaDTO, ProductoDTO } from '@gina/shared';
import { TALLAS_CALZADO, TALLAS_ROPA, formatLps } from '@gina/shared';
import { ApiError } from '../lib/api';
import { subirImagen } from '../lib/subirImagen';
import { Aviso } from './ui';

/**
 * Editor de producto.
 *
 * Todo en una sola página con la columna de la derecha fija, en vez de las
 * cinco pestañas que tenía antes: con pestañas hay que ir a buscar el precio a
 * otro lado para saber si el descuento quedó bien, y guardar obligaba a bajar
 * hasta el final. Aquí lo que se decide junto se ve junto, y el botón de
 * guardar nunca se va de la pantalla.
 */

/** Lo que el formulario mantiene en pantalla. Todo texto para no pelear con los inputs. */
interface Borrador {
  nombre: string;
  descripcion: string;
  precio: string;
  precioOferta: string;
  ofertaInicio: string;
  ofertaFin: string;
  categoriaId: string;
  subcategoria: string;
  tallas: string[];
  colores: string[];
  stock: string;
  imagenes: string[];
  destacado: boolean;
  activo: boolean;
  sku: string;
  marca: string;
  material: string;
  tipoPrenda: string;
  pecho: string;
  cintura: string;
  cadera: string;
  largoPrenda: string;
  manga: string;
  tiro: string;
  pesoGramos: string;
  altoCm: string;
  anchoCm: string;
  largoCm: string;
}

const VACIO: Borrador = {
  nombre: '', descripcion: '', precio: '', precioOferta: '', ofertaInicio: '', ofertaFin: '',
  categoriaId: '', subcategoria: '', tallas: [], colores: [], stock: '0', imagenes: [],
  destacado: false, activo: true, sku: '', marca: '', material: '', tipoPrenda: '',
  pecho: '', cintura: '', cadera: '', largoPrenda: '', manga: '', tiro: '',
  pesoGramos: '', altoCm: '', anchoCm: '', largoCm: '',
};

const MAX_DESCRIPCION = 4000;

/** Un datetime-local necesita 'YYYY-MM-DDTHH:mm' en hora local, no ISO en UTC. */
const aInputFecha = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const txt = (v: number | null | undefined) => (v == null ? '' : String(v));

/**
 * Cada campo se lee a la defensiva.
 *
 * El panel y la API se despliegan por separado: si la API va una versión atrás
 * y no manda `envio` o `medidas`, leerlos directo lanza y React desmonta toda
 * la aplicación. Eso es exactamente lo que dejaba la pantalla en blanco al
 * darle "Editar".
 */
function desdeProducto(p: ProductoDTO): Borrador {
  const m = p.medidas ?? {};
  const envio = p.envio ?? { pesoGramos: null, altoCm: null, anchoCm: null, largoCm: null };
  return {
    ...VACIO,
    nombre: p.nombre ?? '',
    descripcion: p.descripcion ?? '',
    precio: txt(p.precio),
    precioOferta: txt(p.precioOferta),
    ofertaInicio: aInputFecha(p.ofertaInicio),
    ofertaFin: aInputFecha(p.ofertaFin),
    categoriaId: p.categoria?.id ?? '',
    subcategoria: p.subcategoria ?? '',
    tallas: p.tallas ?? [],
    colores: p.colores ?? [],
    stock: txt(p.stock),
    imagenes: p.imagenes ?? [],
    destacado: Boolean(p.destacado),
    activo: p.activo !== false,
    sku: p.sku ?? '',
    marca: p.marca ?? '',
    material: p.material ?? '',
    tipoPrenda: p.tipoPrenda ?? '',
    pecho: txt(m.pecho), cintura: txt(m.cintura), cadera: txt(m.cadera),
    largoPrenda: txt(m.largo), manga: txt(m.manga), tiro: txt(m.tiro),
    pesoGramos: txt(envio.pesoGramos),
    altoCm: txt(envio.altoCm), anchoCm: txt(envio.anchoCm), largoCm: txt(envio.largoCm),
  };
}

/** '' significa "sin dato", que no es lo mismo que 0. */
const numOrNull = (v: string): number | null => {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const fechaOrNull = (v: string): string | null => (v ? new Date(v).toISOString() : null);

function aPayload(b: Borrador) {
  const medidas = {
    ...(numOrNull(b.pecho) != null && { pecho: numOrNull(b.pecho) }),
    ...(numOrNull(b.cintura) != null && { cintura: numOrNull(b.cintura) }),
    ...(numOrNull(b.cadera) != null && { cadera: numOrNull(b.cadera) }),
    ...(numOrNull(b.largoPrenda) != null && { largo: numOrNull(b.largoPrenda) }),
    ...(numOrNull(b.manga) != null && { manga: numOrNull(b.manga) }),
    ...(numOrNull(b.tiro) != null && { tiro: numOrNull(b.tiro) }),
  };

  return {
    nombre: b.nombre.trim(),
    descripcion: b.descripcion.trim(),
    precio: Number(b.precio),
    precioOferta: numOrNull(b.precioOferta),
    ofertaInicio: fechaOrNull(b.ofertaInicio),
    ofertaFin: fechaOrNull(b.ofertaFin),
    categoriaId: b.categoriaId,
    subcategoria: b.subcategoria.trim() || null,
    tallas: b.tallas,
    colores: b.colores,
    stock: Number(b.stock || 0),
    imagenes: b.imagenes,
    destacado: b.destacado,
    activo: b.activo,
    sku: b.sku.trim() || null,
    marca: b.marca.trim() || null,
    material: b.material.trim() || null,
    tipoPrenda: b.tipoPrenda.trim() || null,
    medidas: Object.keys(medidas).length > 0 ? medidas : null,
    pesoGramos: numOrNull(b.pesoGramos),
    altoCm: numOrNull(b.altoCm),
    anchoCm: numOrNull(b.anchoCm),
    largoCm: numOrNull(b.largoCm),
  };
}

/* ------------------------------ piezas de la UI ---------------------------- */

function Bloque({
  titulo,
  nota,
  children,
}: {
  titulo: string;
  nota?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tarjeta min-w-0 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg">{titulo}</h3>
        {nota && <span className="text-xs text-suave">{nota}</span>}
      </div>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="etiqueta">{etiqueta}</span>
      <div className="mt-2">{children}</div>
      {error ? (
        <span className="mt-1 block text-xs text-acento">{error}</span>
      ) : (
        ayuda && <span className="mt-1 block text-xs text-suave">{ayuda}</span>
      )}
    </label>
  );
}

/** Interruptor con etiqueta descriptiva; más claro que una casilla suelta. */
function Interruptor({
  activo,
  onCambio,
  titulo,
  descripcion,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  titulo: string;
  descripcion: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={activo}
        onChange={(e) => onCambio(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#111111]"
      />
      <span className="min-w-0">
        <span className="block text-sm">{titulo}</span>
        <span className="block text-xs text-suave">{descripcion}</span>
      </span>
    </label>
  );
}

/* --------------------------------- editor ---------------------------------- */

export default function FormularioProducto({
  producto,
  categorias,
  onGuardar,
  onCancelar,
}: {
  producto: ProductoDTO | null;
  categorias: CategoriaDTO[];
  onGuardar: (payload: ReturnType<typeof aPayload>) => Promise<void>;
  onCancelar: () => void;
}) {
  const [b, setB] = useState<Borrador>(() =>
    producto ? desdeProducto(producto) : { ...VACIO, categoriaId: categorias[0]?.id ?? '' },
  );
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, string[]>>({});
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [sobreZona, setSobreZona] = useState(false);
  const [colorNuevo, setColorNuevo] = useState('');
  const [tallaNueva, setTallaNueva] = useState('');
  const [sucio, setSucio] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => {
    setSucio(true);
    setB((x) => ({ ...x, [k]: v }));
  };

  const categoria = categorias.find((c) => c.id === b.categoriaId);
  const tallasSugeridas = categoria?.slug === 'calzado' ? TALLAS_CALZADO : TALLAS_ROPA;

  // Avisa antes de cerrar la pestaña con cambios sin guardar. Perder veinte
  // minutos de descripción por un clic es de lo más frustrante que hay.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [sucio]);

  const alSubir = async (archivos: FileList | File[] | null) => {
    const lista = archivos ? Array.from(archivos) : [];
    if (lista.length === 0) return;
    setError(null);
    setSubiendo(true);
    try {
      const urls: string[] = [];
      for (const archivo of lista) urls.push(await subirImagen(archivo, 'productos'));
      setSucio(true);
      setB((x) => ({ ...x, imagenes: [...x.imagenes, ...urls] }));
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} Si la subida no funciona, pega la dirección de la foto abajo.`
          : 'No se pudo subir la imagen',
      );
    } finally {
      setSubiendo(false);
      if (archivoRef.current) archivoRef.current.value = '';
    }
  };

  /** El orden importa: la primera foto es la que se ve en el catálogo. */
  const moverImagen = (i: number, dir: -1 | 1) => {
    const destino = i + dir;
    if (destino < 0 || destino >= b.imagenes.length) return;
    const copia = [...b.imagenes];
    [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
    set('imagenes', copia);
  };

  const agregarColor = () => {
    const c = colorNuevo.trim();
    if (!c || b.colores.includes(c)) return setColorNuevo('');
    set('colores', [...b.colores, c]);
    setColorNuevo('');
  };

  const agregarTalla = () => {
    const t = tallaNueva.trim().toUpperCase();
    if (!t || b.tallas.includes(t)) return setTallaNueva('');
    set('tallas', [...b.tallas, t]);
    setTallaNueva('');
  };

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetalles({});
    if (!b.nombre.trim() || !b.precio || !b.categoriaId) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return setError('Faltan datos obligatorios: nombre, precio y categoría.');
    }
    setGuardando(true);
    try {
      await onGuardar(aPayload(b));
      setSucio(false);
    } catch (err) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.detalles) setDetalles(err.detalles);
      } else {
        setError('No se pudo guardar el producto');
      }
    } finally {
      setGuardando(false);
    }
  };

  const salir = () => {
    if (sucio && !confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
    onCancelar();
  };

  const errorDe = (campo: string) => detalles[campo]?.[0];

  const campoMedida = (etiqueta: string, clave: keyof Borrador, sufijo = 'cm') => (
    <Campo etiqueta={`${etiqueta} (${sufijo})`} error={errorDe(String(clave))}>
      <input
        type="number"
        min={0}
        step="0.1"
        value={b[clave] as string}
        onChange={(e) => set(clave, e.target.value as Borrador[typeof clave])}
        className="campo py-2"
      />
    </Campo>
  );

  // Vista previa del precio: saber al instante en cuánto queda la prenda evita
  // el clásico descuento tecleado al revés.
  const precioNum = Number(b.precio) || 0;
  const ofertaNum = numOrNull(b.precioOferta);
  const hayOferta = ofertaNum != null && ofertaNum > 0 && ofertaNum < precioNum;
  const descuento = hayOferta ? Math.round(((precioNum - ofertaNum) / precioNum) * 100) : null;
  const ofertaInvalida = ofertaNum != null && ofertaNum > 0 && ofertaNum >= precioNum;

  return (
    <form onSubmit={enviar}>
      {/* Barra fija: el nombre de lo que se edita y los botones, siempre a la
          vista. Antes había que bajar hasta el final para guardar. */}
      <div className="sticky top-[7.5rem] z-10 -mx-4 mb-6 border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <div className="min-w-0 flex-1">
            <p className="etiqueta">{producto ? 'Editando producto' : 'Nuevo producto'}</p>
            <p className="truncate font-display text-xl">
              {b.nombre.trim() || 'Sin nombre todavía'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {sucio && <span className="text-xs text-suave">Sin guardar</span>}
            <button type="button" onClick={salir} className="btn-secundario px-4 py-2 text-xs">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || subiendo}
              className="btn-principal px-5 py-2 text-xs"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6">
          <Aviso>{error}</Aviso>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ------------------------------ columna principal ------------------ */}
        <div className="min-w-0 space-y-6">
          <Bloque
            titulo="Fotos"
            nota={b.imagenes.length > 0 ? `${b.imagenes.length} en total` : undefined}
          >
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setSobreZona(true);
              }}
              onDragLeave={() => setSobreZona(false)}
              onDrop={(e) => {
                e.preventDefault();
                setSobreZona(false);
                void alSubir(e.dataTransfer.files);
              }}
              onClick={() => archivoRef.current?.click()}
              className={`cursor-pointer border border-dashed px-6 py-10 text-center transition ${
                sobreZona ? 'border-tinta bg-fondo' : 'border-borde hover:border-tinta'
              }`}
            >
              <p className="text-sm">
                {subiendo ? 'Subiendo fotos…' : 'Arrastra las fotos aquí o haz clic para elegirlas'}
              </p>
              <p className="mt-1 text-xs text-suave">
                Puedes seleccionar varias a la vez. JPG, PNG, WebP o AVIF, hasta 10 MB cada una.
              </p>
              <input
                ref={archivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                onChange={(e) => void alSubir(e.target.files)}
                disabled={subiendo}
                className="hidden"
              />
            </div>

            {b.imagenes.length > 0 && (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {b.imagenes.map((url, i) => (
                  <li key={url} className="group relative border border-borde">
                    <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-0 top-0 bg-tinta px-2 py-1 text-[10px] uppercase tracking-etiqueta text-white">
                        Principal
                      </span>
                    )}
                    <div className="flex items-center justify-between border-t border-borde px-2 py-1.5 text-xs">
                      <span className="text-suave">#{i + 1}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => moverImagen(i, -1)}
                          disabled={i === 0}
                          aria-label={`Mover la foto ${i + 1} antes`}
                          className="px-1 disabled:opacity-25"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          onClick={() => moverImagen(i, 1)}
                          disabled={i === b.imagenes.length - 1}
                          aria-label={`Mover la foto ${i + 1} después`}
                          className="px-1 disabled:opacity-25"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          onClick={() => set('imagenes', b.imagenes.filter((_, j) => j !== i))}
                          aria-label={`Quitar la foto ${i + 1}`}
                          className="px-1 text-acento"
                        >
                          ✕
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <Campo
              etiqueta="…o pega la dirección de una foto"
              ayuda="Sirve mientras no esté configurada la subida directa."
            >
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://…"
                  className="campo py-2"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const valor = e.currentTarget.value.trim();
                    if (!valor) return;
                    set('imagenes', [...b.imagenes, valor]);
                    e.currentTarget.value = '';
                  }}
                />
              </div>
            </Campo>
          </Bloque>

          <Bloque titulo="Información">
            <Campo etiqueta="Nombre *" error={errorDe('nombre')}>
              <input
                value={b.nombre}
                onChange={(e) => set('nombre', e.target.value)}
                placeholder="Top corto leopardo con pliegues"
                className="campo"
              />
            </Campo>

            <Campo
              etiqueta="Descripción"
              ayuda={`${b.descripcion.length} de ${MAX_DESCRIPCION} caracteres. La caja se agranda desde la esquina.`}
              error={errorDe('descripcion')}
            >
              <textarea
                rows={10}
                maxLength={MAX_DESCRIPCION}
                value={b.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                placeholder={
                  'Describe la prenda con detalle: tela, caída, ocasión, cómo queda…\n\nPuedes usar varios párrafos.'
                }
                className="campo min-h-[14rem] resize-y leading-relaxed"
              />
            </Campo>

            <div className="grid gap-5 sm:grid-cols-2">
              <Campo etiqueta="Categoría *" error={errorDe('categoriaId')}>
                <select
                  value={b.categoriaId}
                  onChange={(e) => set('categoriaId', e.target.value)}
                  className="campo"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo etiqueta="Subcategoría" ayuda="Escribe una nueva o elige de la lista.">
                <input
                  list="subcats"
                  value={b.subcategoria}
                  onChange={(e) => set('subcategoria', e.target.value)}
                  className="campo"
                />
                <datalist id="subcats">
                  {categoria?.subcategorias.map((s) => <option key={s} value={s} />)}
                </datalist>
              </Campo>

              <Campo etiqueta="Tipo de prenda">
                <input
                  value={b.tipoPrenda}
                  onChange={(e) => set('tipoPrenda', e.target.value)}
                  placeholder="Top, Suéter, Camiseta…"
                  className="campo"
                />
              </Campo>

              <Campo etiqueta="Material">
                <input
                  value={b.material}
                  onChange={(e) => set('material', e.target.value)}
                  placeholder="Algodón, mezclilla…"
                  className="campo"
                />
              </Campo>
            </div>
          </Bloque>

          <Bloque titulo="Tallas y colores">
            <div>
              <span className="etiqueta">Tallas disponibles</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...new Set([...tallasSugeridas, ...b.tallas])].map((t) => {
                  const puesta = b.tallas.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() =>
                        set('tallas', puesta ? b.tallas.filter((x) => x !== t) : [...b.tallas, t])
                      }
                      className={`min-w-[3rem] border px-3 py-2 text-sm transition ${
                        puesta
                          ? 'border-tinta bg-tinta text-white'
                          : 'border-borde hover:border-tinta'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={tallaNueva}
                  onChange={(e) => setTallaNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarTalla();
                    }
                  }}
                  placeholder="Otra talla"
                  className="campo w-40 py-2 text-sm"
                />
                <button type="button" onClick={agregarTalla} className="btn-secundario px-4 py-2 text-xs">
                  Añadir
                </button>
              </div>
              <p className="mt-2 text-xs text-suave">
                Sin tallas marcadas, el cliente compra sin elegir una.
              </p>
            </div>

            <div className="border-t border-borde pt-5">
              <span className="etiqueta">Colores</span>
              {b.colores.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {b.colores.map((c) => (
                    <li
                      key={c}
                      className="flex items-center gap-2 border border-borde px-3 py-1.5 text-sm"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => set('colores', b.colores.filter((x) => x !== c))}
                        aria-label={`Quitar ${c}`}
                        className="text-suave hover:text-acento"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={colorNuevo}
                  onChange={(e) => setColorNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      agregarColor();
                    }
                  }}
                  placeholder="Negro"
                  className="campo w-48 py-2 text-sm"
                />
                <button type="button" onClick={agregarColor} className="btn-secundario px-4 py-2 text-xs">
                  Añadir color
                </button>
              </div>
            </div>
          </Bloque>

          {/* Plegados: la mayoría de las prendas se cargan sin tocarlos, y
              tenerlos siempre abiertos alarga la página sin necesidad. */}
          <details className="tarjeta min-w-0 p-6">
            <summary className="cursor-pointer text-lg">Medidas de la prenda</summary>
            <p className="mt-2 text-xs text-suave">
              Aparecen en la guía de tallas de la ficha. Opcional, pero ayuda mucho a que no
              devuelvan la prenda por talla.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {campoMedida('Pecho', 'pecho')}
              {campoMedida('Cintura', 'cintura')}
              {campoMedida('Cadera', 'cadera')}
              {campoMedida('Largo', 'largoPrenda')}
              {campoMedida('Manga', 'manga')}
              {campoMedida('Tiro', 'tiro')}
            </div>
          </details>

          <details className="tarjeta min-w-0 p-6">
            <summary className="cursor-pointer text-lg">Peso y dimensiones del paquete</summary>
            <p className="mt-2 text-xs text-suave">
              Para cotizar con la mensajería. No se le muestran al cliente.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-4">
              {campoMedida('Peso', 'pesoGramos', 'g')}
              {campoMedida('Alto', 'altoCm')}
              {campoMedida('Ancho', 'anchoCm')}
              {campoMedida('Largo', 'largoCm')}
            </div>
          </details>
        </div>

        {/* --------------------------------- barra lateral ------------------- */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-[14rem]">
          <Bloque titulo="Publicación">
            <Interruptor
              activo={b.activo}
              onCambio={(v) => set('activo', v)}
              titulo="Visible en la tienda"
              descripcion="Si lo apagas, deja de aparecer en el catálogo."
            />
            <Interruptor
              activo={b.destacado}
              onCambio={(v) => set('destacado', v)}
              titulo="Destacado"
              descripcion="Aparece en la portada del inicio."
            />
          </Bloque>

          <Bloque titulo="Precio">
            <Campo etiqueta="Precio normal (L) *" error={errorDe('precio')}>
              <input
                type="number"
                min={0}
                step="0.01"
                value={b.precio}
                onChange={(e) => set('precio', e.target.value)}
                className="campo"
              />
            </Campo>

            <Campo
              etiqueta="Precio de oferta (L)"
              error={errorDe('precioOferta') ?? (ofertaInvalida ? 'La oferta debe ser menor al precio normal.' : undefined)}
              ayuda="Déjalo vacío si no hay rebaja."
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={b.precioOferta}
                onChange={(e) => set('precioOferta', e.target.value)}
                className="campo"
              />
            </Campo>

            <div className="border-t border-borde pt-4 text-sm">
              <p className="etiqueta">Se verá así</p>
              <p className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className={`text-lg ${hayOferta ? 'text-acento' : ''}`}>
                  {formatLps(hayOferta ? ofertaNum : precioNum)}
                </span>
                {hayOferta && (
                  <>
                    <span className="text-xs text-suave line-through">{formatLps(precioNum)}</span>
                    <span className="bg-acento px-2 py-0.5 text-[10px] uppercase tracking-etiqueta text-white">
                      -{descuento}%
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="space-y-4 border-t border-borde pt-4">
              <Campo etiqueta="La oferta empieza">
                <input
                  type="datetime-local"
                  value={b.ofertaInicio}
                  onChange={(e) => set('ofertaInicio', e.target.value)}
                  className="campo py-2 text-sm"
                />
              </Campo>
              <Campo
                etiqueta="La oferta termina"
                error={errorDe('ofertaFin')}
                ayuda="Sin fechas, la oferta aplica siempre."
              >
                <input
                  type="datetime-local"
                  value={b.ofertaFin}
                  onChange={(e) => set('ofertaFin', e.target.value)}
                  className="campo py-2 text-sm"
                />
              </Campo>
            </div>
          </Bloque>

          <Bloque titulo="Inventario">
            <Campo
              etiqueta="Unidades disponibles"
              error={errorDe('stock')}
              ayuda="En cero, la tienda lo muestra agotado."
            >
              <input
                type="number"
                min={0}
                value={b.stock}
                onChange={(e) => set('stock', e.target.value)}
                className="campo"
              />
            </Campo>
            <Campo
              etiqueta="Código / SKU"
              error={errorDe('sku')}
              ayuda="Único por producto. Puede quedar vacío."
            >
              <input
                value={b.sku}
                onChange={(e) => set('sku', e.target.value)}
                placeholder="TB01-LEO"
                className="campo"
              />
            </Campo>
            <Campo etiqueta="Marca">
              <input
                value={b.marca}
                onChange={(e) => set('marca', e.target.value)}
                className="campo"
              />
            </Campo>
          </Bloque>
        </aside>
      </div>

      {/* En móvil la barra de arriba se pierde al desplazarse; abajo queda una
          segunda salida para no tener que subir hasta el tope. */}
      <div className="mt-8 flex gap-3 border-t border-borde pt-6 lg:hidden">
        <button
          type="submit"
          disabled={guardando || subiendo}
          className="btn-principal flex-1"
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={salir} className="btn-secundario flex-1">
          Cancelar
        </button>
      </div>
    </form>
  );
}
