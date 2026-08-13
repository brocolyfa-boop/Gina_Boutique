import { Link, useParams } from 'react-router-dom';
import { MARCA, enlaceWhatsApp } from '@gina/shared';
import { Vacio } from '../components/ui';
import { useTitulo } from '../lib/titulo';

/**
 * Devoluciones, términos y privacidad.
 *
 * En ropa la política de cambios no es un trámite legal: no decir qué pasa si
 * la talla no queda es de las razones más comunes para cerrar la pestaña. Por
 * eso va enlazada desde el pie y desde la ficha de producto.
 *
 * El texto es un punto de partida razonable para una tienda hondureña con pago
 * contra entrega. Antes de operar de verdad conviene que lo revise alguien que
 * sepa de leyes.
 */

interface Seccion {
  titulo: string;
  parrafos: string[];
  lista?: string[];
}

interface Politica {
  slug: string;
  titulo: string;
  entrada: string;
  secciones: Seccion[];
}

const CONTACTO = `WhatsApp ${MARCA.redes.whatsapp}`;

const POLITICAS: Politica[] = [
  {
    slug: 'cambios-y-devoluciones',
    titulo: 'Cambios y devoluciones',
    entrada:
      'Queremos que la prenda te quede como la imaginaste. Si algo no salió bien, esto es lo que hacemos.',
    secciones: [
      {
        titulo: 'Cambio por talla',
        parrafos: [
          `Tienes 7 días desde que recibes tu pedido para pedir un cambio de talla, siempre que la prenda esté sin usar, con sus etiquetas y en las mismas condiciones en que llegó. Escríbenos por ${CONTACTO} con tu número de pedido y te decimos cómo seguir.`,
          'Si la talla que quieres está disponible, hacemos el cambio. Si no, puedes elegir otra prenda del mismo valor o dejar el monto a favor para tu siguiente compra.',
        ],
      },
      {
        titulo: 'Prenda con defecto o equivocada',
        parrafos: [
          'Si te llegó una prenda con falla de fábrica o distinta a la que pediste, la reponemos o te devolvemos el dinero completo, incluido el envío. El costo de recogerla corre por nuestra cuenta.',
          'Avísanos dentro de las 48 horas siguientes a recibirla y mándanos una foto: con eso resolvemos sin darle vueltas.',
        ],
      },
      {
        titulo: 'Lo que no podemos cambiar',
        parrafos: ['Por higiene y por el estado de la prenda, no aceptamos cambios de:'],
        lista: [
          'Ropa interior, trajes de baño y accesorios de uso personal.',
          'Prendas usadas, lavadas, perfumadas o sin etiqueta.',
          'Artículos comprados en liquidación final, cuando así se indique en la ficha.',
        ],
      },
      {
        titulo: 'Costo del envío en un cambio',
        parrafos: [
          'Si el cambio es por gusto o por talla, el envío de ida y vuelta corre por cuenta del cliente, a la misma tarifa de siempre: L 90 dentro de Tegucigalpa y L 120 al resto del país.',
          'Si el cambio es por un error nuestro, no pagas nada.',
        ],
      },
    ],
  },
  {
    slug: 'terminos',
    titulo: 'Términos y condiciones',
    entrada: `Estas son las reglas con las que ${MARCA.nombre} vende en línea.`,
    secciones: [
      {
        titulo: 'Precios y disponibilidad',
        parrafos: [
          'Todos los precios están en lempiras e incluyen los impuestos que correspondan. El costo del envío se calcula aparte, al elegir tu departamento y municipio.',
          'Trabajamos con inventario limitado y prendas únicas. Si un artículo se agota entre que lo agregas al carrito y confirmas, te lo decimos antes de cobrar y no se procesa el pedido.',
        ],
      },
      {
        titulo: 'Pedidos y entrega',
        parrafos: [
          'Enviamos a los 18 departamentos de Honduras. La entrega toma de 1 a 2 días hábiles según la zona.',
          'La mensajería te contacta al teléfono que dejaste en el pedido. Si no logramos ubicarte tras dos intentos, el paquete regresa y te escribimos para reprogramar.',
        ],
      },
      {
        titulo: 'Pago',
        parrafos: [
          'Por ahora el pago es contra entrega: pagas cuando recibes. No pedimos datos de tarjeta en la tienda.',
        ],
      },
      {
        titulo: 'Colores y fotografías',
        parrafos: [
          'Cuidamos que las fotos se parezcan a la prenda real, pero el color puede verse distinto según la pantalla. Una diferencia de tono no cuenta como defecto; aun así, si no te convence, aplica el cambio por gusto.',
        ],
      },
    ],
  },
  {
    slug: 'privacidad',
    titulo: 'Aviso de privacidad',
    entrada: 'Qué datos te pedimos, para qué los usamos y qué no hacemos con ellos.',
    secciones: [
      {
        titulo: 'Qué guardamos',
        parrafos: ['Solo lo necesario para entregarte el pedido:'],
        lista: [
          'Tu nombre, teléfono y dirección de entrega.',
          'Tu correo, si decides dejarlo.',
          'El detalle de tus pedidos.',
        ],
      },
      {
        titulo: 'Para qué lo usamos',
        parrafos: [
          'Para preparar y entregar tu pedido, contactarte si hay algún problema con él, y llevar el control de nuestras ventas.',
          'No vendemos ni compartimos tus datos con terceros para publicidad. Los compartimos únicamente con la mensajería que lleva tu paquete, y solo lo que hace falta para entregarlo.',
        ],
      },
      {
        titulo: 'Tu cuenta',
        parrafos: [
          'No necesitas cuenta para comprar. Si creas una, tu contraseña se guarda cifrada: ni nosotros podemos leerla.',
          `Si quieres que borremos tus datos, escríbenos por ${CONTACTO}. Conservamos el registro de las ventas ya realizadas, porque es información contable que estamos obligados a mantener.`,
        ],
      },
    ],
  },
];

export default function Politicas() {
  const { slug } = useParams();
  const politica = POLITICAS.find((p) => p.slug === slug);
  useTitulo(politica?.titulo ?? 'Página no encontrada', politica?.entrada);

  if (!politica) {
    return (
      <Vacio
        titulo="Página no encontrada"
        texto="Ese documento no existe o cambió de dirección."
        accion={
          <Link to="/" className="btn-principal">
            Volver al inicio
          </Link>
        }
      />
    );
  }

  const wa = enlaceWhatsApp(
    MARCA.redes.whatsapp,
    `Hola ${MARCA.nombre}, tengo una consulta sobre ${politica.titulo.toLowerCase()}.`,
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
      <nav className="etiqueta mb-6">
        <Link to="/" className="hover:text-tinta">
          Inicio
        </Link>
        {' / '}
        {politica.titulo}
      </nav>

      <h1 className="text-3xl lg:text-4xl">{politica.titulo}</h1>
      <p className="mt-4 text-base leading-relaxed text-suave">{politica.entrada}</p>

      <div className="mt-10 space-y-10">
        {politica.secciones.map((s) => (
          <section key={s.titulo}>
            <h2 className="text-xl">{s.titulo}</h2>
            {s.parrafos.map((p) => (
              <p key={p} className="mt-3 text-sm leading-relaxed text-suave">
                {p}
              </p>
            ))}
            {s.lista && (
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-suave">
                {s.lista.map((li) => (
                  <li key={li} className="flex gap-3">
                    <span aria-hidden className="mt-2 h-1 w-1 shrink-0 bg-suave" />
                    {li}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="marco-pago mt-12">
        <h2 className="text-lg">¿Te quedó una duda?</h2>
        <p className="mt-2 text-sm text-suave">
          Escríbenos y te respondemos por WhatsApp. Es la vía más rápida.
        </p>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="btn-principal mt-5">
            Escribir por WhatsApp
          </a>
        )}
      </div>

      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-borde pt-6 text-sm">
        {POLITICAS.filter((p) => p.slug !== politica.slug).map((p) => (
          <Link key={p.slug} to={`/politicas/${p.slug}`} className="text-suave hover:text-tinta">
            {p.titulo}
          </Link>
        ))}
      </nav>
    </article>
  );
}
