import { Link } from 'react-router-dom';
import { useTitulo } from '../lib/titulo';

/**
 * Página 404.
 *
 * Antes cualquier dirección desconocida redirigía al inicio en silencio. Eso
 * hace pensar que el enlace funcionó y que la tienda perdió el contenido —
 * peor que decir claramente que la página no existe y ofrecer por dónde seguir.
 */
export default function NoEncontrada() {
  useTitulo('Página no encontrada');

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center lg:px-8">
      <p className="etiqueta">Error 404</p>
      <h1 className="mt-4 text-4xl">No encontramos esta página</h1>
      <p className="mt-4 text-sm leading-relaxed text-suave">
        Puede que el enlace esté mal escrito o que la prenda ya no esté en catálogo. Estas son las
        salidas rápidas:
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link to="/catalogo" className="btn-principal">
          Ver catálogo
        </Link>
        <Link to="/" className="btn-secundario">
          Ir al inicio
        </Link>
      </div>

      <nav className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
        <Link to="/seguimiento" className="text-suave hover:text-tinta">
          Seguir mi pedido
        </Link>
        <Link to="/politicas/cambios-y-devoluciones" className="text-suave hover:text-tinta">
          Cambios y devoluciones
        </Link>
      </nav>
    </div>
  );
}
