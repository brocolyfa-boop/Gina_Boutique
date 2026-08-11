import { useRef, useState } from 'react';
import type { CategoriaDTO, ProductoDTO } from '@gina/shared';
import { TALLAS_CALZADO, TALLAS_ROPA } from '@gina/shared';
import { ApiError } from '../lib/api';
import { subirImagen } from '../lib/subirImagen';
import { Aviso } from './ui';

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
  colores: string;
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
  categoriaId: '', subcategoria: '', tallas: [], colores: '', stock: '0', imagenes: [],
  destacado: false, activo: true, sku: '', marca: '', material: '', tipoPrenda: '',
  pecho: '', cintura: '', cadera: '', largoPrenda: '', manga: '', tiro: '',
  pesoGramos: '', altoCm: '', anchoCm: '', largoCm: '',
};

/** Un datetime-local necesita 'YYYY-MM-DDTHH:mm' en hora local, no ISO en UTC. */
const aInputFecha = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

function desdeProducto(p: ProductoDTO): Borrador {
  const m = p.medidas ?? {};
  const txt = (v: number | null | undefined) => (v == null ? '' : String(v));
  return {
    nombre: p.nombre,
    descripcion: p.descripcion,
    precio: String(p.precio),
    precioOferta: txt(p.precioOferta),
    ofertaInicio: aInputFecha(p.ofertaInicio),
    ofertaFin: aInputFecha(p.ofertaFin),
    categoriaId: p.categoria.id,
    subcategoria: p.subcategoria ?? '',
    tallas: p.tallas,
    colores: p.colores.join(', '),
    stock: String(p.stock),
    imagenes: p.imagenes,
    destacado: p.destacado,
    activo: p.activo,
    sku: p.sku ?? '',
    marca: p.marca ?? '',
    material: p.material ?? '',
    tipoPrenda: p.tipoPrenda ?? '',
    pecho: txt(m.pecho), cintura: txt(m.cintura), cadera: txt(m.cadera),
    largoPrenda: txt(m.largo), manga: txt(m.manga), tiro: txt(m.tiro),
    pesoGramos: txt(p.envio.pesoGramos),
    altoCm: txt(p.envio.altoCm), anchoCm: txt(p.envio.anchoCm), largoCm: txt(p.envio.largoCm),
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
    colores: b.colores.split(',').map((c) => c.trim()).filter(Boolean),
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

const PESTANAS = [
  { clave: 'info', texto: 'Información' },
  { clave: 'precios', texto: 'Precios y oferta' },
  { clave: 'fotos', texto: 'Fotos' },
  { clave: 'medidas', texto: 'Tallas y medidas' },
  { clave: 'envio', texto: 'Inventario y envío' },
] as const;

type Pestana = (typeof PESTANAS)[number]['clave'];

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
  const [pestana, setPestana] = useState<Pestana>('info');
  const [error, setError] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<Record<string, string[]>>({});
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));

  const categoria = categorias.find((c) => c.id === b.categoriaId);
  const tallasSugeridas =
    categoria?.slug === 'calzado' ? TALLAS_CALZADO : TALLAS_ROPA;

  const alSubir = async (archivos: FileList | null) => {
    if (!archivos?.length) return;
    setError(null);
    setSubiendo(true);
    try {
      const urls: string[] = [];
      for (const archivo of Array.from(archivos)) urls.push(await subirImagen(archivo, 'productos'));
      setB((x) => ({ ...x, imagenes: [...x.imagenes, ...urls] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la imagen');
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

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetalles({});
    if (!b.nombre.trim() || !b.precio || !b.categoriaId) {
      setPestana('info');
      return setError('Nombre, precio y categoría son obligatorios');
    }
    setGuardando(true);
    try {
      await onGuardar(aPayload(b));
    } catch (err) {
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

  const errorDe = (campo: string) => detalles[campo]?.[0];

  const campoNum = (etiqueta: string, clave: keyof Borrador, sufijo = 'cm') => (
    <label className="block">
      <span className="etiqueta">
        {etiqueta} ({sufijo})
      </span>
      <input
        type="number"
        min={0}
        step="0.1"
        value={b[clave] as string}
        onChange={(e) => set(clave, e.target.value as Borrador[typeof clave])}
        className="campo mt-2"
      />
      {errorDe(String(clave)) && (
        <span className="mt-1 block text-xs text-acento">{errorDe(String(clave))}</span>
      )}
    </label>
  );

  return (
    <form onSubmit={enviar} className="tarjeta p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl">{producto ? 'Editar producto' : 'Nuevo producto'}</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={b.activo} onChange={(e) => set('activo', e.target.checked)} />
          Visible en la tienda
        </label>
      </div>

      <nav className="mt-6 flex flex-wrap gap-4 border-b border-borde">
        {PESTANAS.map((p) => (
          <button
            key={p.clave}
            type="button"
            onClick={() => setPestana(p.clave)}
            className={`-mb-px border-b-2 pb-3 text-xs uppercase tracking-etiqueta transition ${
              pestana === p.clave ? 'border-tinta text-tinta' : 'border-transparent text-suave'
            }`}
          >
            {p.texto}
          </button>
        ))}
      </nav>

      <div className="mt-6 space-y-4">
        {pestana === 'info' && (
          <>
            <label className="block">
              <span className="etiqueta">Nombre *</span>
              <input value={b.nombre} onChange={(e) => set('nombre', e.target.value)} className="campo mt-2" />
              {errorDe('nombre') && <span className="mt-1 block text-xs text-acento">{errorDe('nombre')}</span>}
            </label>
            <label className="block">
              <span className="etiqueta">Descripción</span>
              <textarea
                rows={12}
                value={b.descripcion}
                onChange={(e) => set('descripcion', e.target.value)}
                placeholder={'Describe la prenda con detalle: tela, caída, ocasión, cómo queda…\n\nPuedes usar varios párrafos.'}
                className="campo mt-2 min-h-[16rem] resize-y"
              />
              <span className="mt-1 block text-xs text-suave">
                {b.descripcion.length} / 4000 caracteres. La caja se puede agrandar desde la
                esquina.
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="etiqueta">Categoría *</span>
                <select
                  value={b.categoriaId}
                  onChange={(e) => set('categoriaId', e.target.value)}
                  className="campo mt-2"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="etiqueta">Subcategoría</span>
                <input
                  list="subcats"
                  value={b.subcategoria}
                  onChange={(e) => set('subcategoria', e.target.value)}
                  className="campo mt-2"
                />
                <datalist id="subcats">
                  {categoria?.subcategorias.map((s) => <option key={s} value={s} />)}
                </datalist>
              </label>
              <label className="block">
                <span className="etiqueta">Marca</span>
                <input value={b.marca} onChange={(e) => set('marca', e.target.value)} className="campo mt-2" />
              </label>
              <label className="block">
                <span className="etiqueta">Material</span>
                <input value={b.material} onChange={(e) => set('material', e.target.value)} className="campo mt-2" />
              </label>
              <label className="block">
                <span className="etiqueta">Tipo de prenda</span>
                <input value={b.tipoPrenda} onChange={(e) => set('tipoPrenda', e.target.value)} className="campo mt-2" />
              </label>
              <label className="block">
                <span className="etiqueta">Código / SKU</span>
                <input value={b.sku} onChange={(e) => set('sku', e.target.value)} className="campo mt-2" />
                <span className="mt-1 block text-xs text-suave">Debe ser único. Déjalo vacío si no usas códigos.</span>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={b.destacado} onChange={(e) => set('destacado', e.target.checked)} />
              Mostrar en “Destacados” del inicio
            </label>
          </>
        )}

        {pestana === 'precios' && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="etiqueta">Precio normal (L) *</span>
                <input
                  type="number" min={0} step="0.01"
                  value={b.precio}
                  onChange={(e) => set('precio', e.target.value)}
                  className="campo mt-2"
                />
                {errorDe('precio') && <span className="mt-1 block text-xs text-acento">{errorDe('precio')}</span>}
              </label>
              <label className="block">
                <span className="etiqueta">Precio de oferta (L)</span>
                <input
                  type="number" min={0} step="0.01"
                  value={b.precioOferta}
                  onChange={(e) => set('precioOferta', e.target.value)}
                  className="campo mt-2"
                />
                {errorDe('precioOferta') && (
                  <span className="mt-1 block text-xs text-acento">{errorDe('precioOferta')}</span>
                )}
              </label>
              <label className="block">
                <span className="etiqueta">La oferta empieza</span>
                <input
                  type="datetime-local"
                  value={b.ofertaInicio}
                  onChange={(e) => set('ofertaInicio', e.target.value)}
                  className="campo mt-2"
                />
              </label>
              <label className="block">
                <span className="etiqueta">La oferta termina</span>
                <input
                  type="datetime-local"
                  value={b.ofertaFin}
                  onChange={(e) => set('ofertaFin', e.target.value)}
                  className="campo mt-2"
                />
                {errorDe('ofertaFin') && (
                  <span className="mt-1 block text-xs text-acento">{errorDe('ofertaFin')}</span>
                )}
              </label>
            </div>
            <p className="text-xs text-suave">
              Si dejas las fechas vacías, la oferta aplica siempre. Con fechas, fuera de la ventana se
              cobra el precio normal automáticamente.
            </p>
          </>
        )}

        {pestana === 'fotos' && (
          <>
            <div>
              <span className="etiqueta">Fotos del producto</span>
              <input
                ref={archivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                multiple
                onChange={(e) => void alSubir(e.target.files)}
                disabled={subiendo}
                className="campo mt-2"
              />
              <span className="mt-1 block text-xs text-suave">
                {subiendo
                  ? 'Subiendo…'
                  : 'Puedes elegir varias fotos a la vez. JPG, PNG, WebP o AVIF, máximo 10 MB cada una.'}
              </span>
            </div>

            {b.imagenes.length === 0 ? (
              <p className="text-sm text-suave">Todavía no hay fotos.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {b.imagenes.map((url, i) => (
                  <li key={url} className="border border-borde p-2">
                    <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={i === 0 ? 'text-tinta' : 'text-suave'}>
                        {i === 0 ? 'Principal' : `#${i + 1}`}
                      </span>
                      <span className="flex gap-1">
                        <button type="button" onClick={() => moverImagen(i, -1)} disabled={i === 0}
                          aria-label="Mover antes" className="px-1 disabled:opacity-30">←</button>
                        <button type="button" onClick={() => moverImagen(i, 1)} disabled={i === b.imagenes.length - 1}
                          aria-label="Mover después" className="px-1 disabled:opacity-30">→</button>
                        <button type="button" onClick={() => set('imagenes', b.imagenes.filter((_, j) => j !== i))}
                          aria-label="Quitar" className="px-1 text-acento">✕</button>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-suave">La primera foto es la que aparece en el catálogo.</p>
          </>
        )}

        {pestana === 'medidas' && (
          <>
            <div>
              <span className="etiqueta">Tallas disponibles</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {tallasSugeridas.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() =>
                      set('tallas', b.tallas.includes(t) ? b.tallas.filter((x) => x !== t) : [...b.tallas, t])
                    }
                    className={`min-w-[3rem] border px-3 py-2 text-sm transition ${
                      b.tallas.includes(t) ? 'border-tinta bg-tinta text-white' : 'border-borde hover:border-tinta'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <span className="mt-2 block text-xs text-suave">
                Sin tallas seleccionadas, el cliente no tendrá que elegir una.
              </span>
            </div>

            <label className="block">
              <span className="etiqueta">Colores</span>
              <input
                value={b.colores}
                onChange={(e) => set('colores', e.target.value)}
                placeholder="Negro, Rosa, Azul marino"
                className="campo mt-2"
              />
              <span className="mt-1 block text-xs text-suave">Sepáralos con comas.</span>
            </label>

            <div>
              <span className="etiqueta">Medidas de la prenda</span>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                {campoNum('Pecho', 'pecho')}
                {campoNum('Cintura', 'cintura')}
                {campoNum('Cadera', 'cadera')}
                {campoNum('Largo', 'largoPrenda')}
                {campoNum('Manga', 'manga')}
                {campoNum('Tiro', 'tiro')}
              </div>
              <span className="mt-2 block text-xs text-suave">
                Llena solo las que apliquen a esta prenda.
              </span>
            </div>
          </>
        )}

        {pestana === 'envio' && (
          <>
            <label className="block sm:max-w-xs">
              <span className="etiqueta">Existencias</span>
              <input
                type="number" min={0}
                value={b.stock}
                onChange={(e) => set('stock', e.target.value)}
                className="campo mt-2"
              />
              <span className="mt-1 block text-xs text-suave">En 0 el producto aparece como agotado.</span>
            </label>

            <div>
              <span className="etiqueta">Datos del paquete</span>
              <div className="mt-3 grid gap-4 sm:grid-cols-4">
                {campoNum('Peso', 'pesoGramos', 'g')}
                {campoNum('Alto', 'altoCm')}
                {campoNum('Ancho', 'anchoCm')}
                {campoNum('Largo', 'largoCm')}
              </div>
              <span className="mt-2 block text-xs text-suave">
                Sirven para cotizar envíos con mensajería. Hoy el envío es fijo, así que son opcionales.
              </span>
            </div>
          </>
        )}
      </div>

      {error && <div className="mt-6"><Aviso>{error}</Aviso></div>}

      <div className="mt-8 flex gap-3">
        <button type="submit" disabled={guardando || subiendo} className="btn-principal">
          {guardando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <button type="button" onClick={onCancelar} className="btn-secundario">
          Cancelar
        </button>
      </div>
    </form>
  );
}
