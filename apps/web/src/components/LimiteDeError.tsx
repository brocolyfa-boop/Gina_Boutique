import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Red de seguridad para errores de render.
 *
 * Sin esto, un solo error en cualquier componente desmonta el árbol entero y
 * el cliente se queda viendo una pantalla en blanco, sin saber si la página
 * cargó mal, si perdió la sesión o si la tienda se cayó. Pasó de verdad: al
 * abrir un producto para editarlo, el panel se quedaba en blanco.
 *
 * Tiene que ser una clase: los hooks no pueden capturar errores de render.
 */
interface Props {
  children: ReactNode;
  /** Texto de contexto, p. ej. "el formulario del producto". */
  donde?: string;
}

interface State {
  error: Error | null;
}

export default class LimiteDeError extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Queda en la consola del navegador para poder diagnosticarlo después.
    console.error('Error de render capturado:', error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="etiqueta">Algo falló</p>
        <h2 className="mt-3 text-2xl">
          No pudimos mostrar {this.props.donde ?? 'esta sección'}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-suave">
          El resto de la tienda sigue funcionando. Puedes intentar de nuevo; si vuelve a pasar,
          avísanos con el detalle de abajo.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <button onClick={() => this.setState({ error: null })} className="btn-principal">
            Intentar de nuevo
          </button>
          <button onClick={() => window.location.reload()} className="btn-secundario">
            Recargar la página
          </button>
        </div>

        {/* El mensaje técnico va escondido: no le sirve al cliente, pero es lo
            primero que hace falta cuando alguien reporta el problema. */}
        <details className="mt-8 text-left">
          <summary className="cursor-pointer text-xs uppercase tracking-etiqueta text-suave">
            Detalle técnico
          </summary>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words border border-borde bg-fondo p-4 text-xs text-suave">
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
