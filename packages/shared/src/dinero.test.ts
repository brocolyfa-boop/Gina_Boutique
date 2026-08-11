/**
 * Pruebas de lo que toca dinero.
 *
 * Se prueba este paquete y no otro porque aquí viven las tres reglas que, si se
 * rompen, hacen que la tienda cobre mal: el precio de oferta, las promociones y
 * la tarifa de envío según la zona. Los tres cálculos los comparten el
 * catálogo, el carrito y el cobro, así que un error aquí se paga en todas
 * partes a la vez.
 *
 * Corre con el ejecutor de pruebas de Node, sin dependencias nuevas:
 *   npm test -w @gina/shared
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  costoEnvioPara,
  descuentoTotalPorcentaje,
  esTegucigalpa,
  formatLps,
  ofertaVigente,
  precioConPromociones,
  precioFinal,
  redondear,
  normalizarWhatsApp,
  enlaceWhatsApp,
  type PromocionAplicable,
} from './index.js';

const AYER = new Date('2026-08-10T12:00:00Z');
const HOY = new Date('2026-08-11T12:00:00Z');
const MANANA = new Date('2026-08-12T12:00:00Z');

const promo = (p: Partial<PromocionAplicable>): PromocionAplicable => ({
  tipo: 'porcentaje',
  valor: 10,
  productoIds: [],
  categoriaId: null,
  fechaInicio: AYER,
  fechaFin: MANANA,
  activo: true,
  ...p,
});

const prenda = {
  id: 'prod-1',
  categoriaId: 'cat-mujer',
  precio: 1000,
  precioOferta: null as number | null,
  ofertaInicio: null as Date | null,
  ofertaFin: null as Date | null,
};

describe('redondeo y formato', () => {
  it('redondea a dos decimales sin arrastrar error binario', () => {
    // 0.1 + 0.2 en coma flotante da 0.30000000000000004.
    assert.equal(redondear(0.1 + 0.2), 0.3);
    assert.equal(redondear(1234.567), 1234.57);
  });

  it('formatea en lempiras', () => {
    assert.match(formatLps(1234.5), /1,234\.50/);
    assert.match(formatLps(1234.5), /^L/);
  });
});

describe('oferta del producto', () => {
  it('ignora una oferta que no es menor al precio', () => {
    assert.equal(ofertaVigente(1000, 1000), false);
    assert.equal(ofertaVigente(1000, 1200), false);
    assert.equal(precioFinal(1000, 1200), 1000);
  });

  it('no aplica una oferta que todavía no empieza', () => {
    assert.equal(precioFinal(1000, 700, { inicio: MANANA, fin: null }, HOY), 1000);
  });

  it('no aplica una oferta vencida', () => {
    assert.equal(precioFinal(1000, 700, { inicio: null, fin: AYER }, HOY), 1000);
  });

  it('aplica la oferta dentro de su ventana', () => {
    assert.equal(precioFinal(1000, 700, { inicio: AYER, fin: MANANA }, HOY), 700);
  });
});

describe('promociones', () => {
  it('sin promociones cobra el precio de lista', () => {
    assert.equal(precioConPromociones(prenda, [], HOY), 1000);
    assert.equal(descuentoTotalPorcentaje(prenda, [], HOY), null);
  });

  it('aplica un porcentaje de toda la tienda', () => {
    assert.equal(precioConPromociones(prenda, [promo({ valor: 25 })], HOY), 750);
    assert.equal(descuentoTotalPorcentaje(prenda, [promo({ valor: 25 })], HOY), 25);
  });

  it('aplica un monto fijo', () => {
    assert.equal(
      precioConPromociones(prenda, [promo({ tipo: 'monto_fijo', valor: 150 })], HOY),
      850,
    );
  });

  it('NO acumula: se queda con la mejor para el cliente', () => {
    // Acumular dos del 50% dejaría la prenda en 250 en vez de 500.
    const dos = [promo({ valor: 50 }), promo({ valor: 50 })];
    assert.equal(precioConPromociones(prenda, dos, HOY), 500);
  });

  it('elige la que más conviene entre porcentaje y monto fijo', () => {
    const mezcla = [promo({ valor: 10 }), promo({ tipo: 'monto_fijo', valor: 300 })];
    assert.equal(precioConPromociones(prenda, mezcla, HOY), 700);
  });

  it('nunca deja el precio por debajo de cero', () => {
    const enorme = promo({ tipo: 'monto_fijo', valor: 99999 });
    assert.equal(precioConPromociones(prenda, [enorme], HOY), 0);
  });

  it('ignora las que no están vigentes o están desactivadas', () => {
    const vencida = promo({ valor: 90, fechaFin: AYER });
    const futura = promo({ valor: 90, fechaInicio: MANANA, fechaFin: MANANA });
    const apagada = promo({ valor: 90, activo: false });
    assert.equal(precioConPromociones(prenda, [vencida, futura, apagada], HOY), 1000);
  });

  it('respeta el alcance por categoría', () => {
    const otraCategoria = promo({ valor: 50, categoriaId: 'cat-hombre' });
    const suCategoria = promo({ valor: 50, categoriaId: 'cat-mujer' });
    assert.equal(precioConPromociones(prenda, [otraCategoria], HOY), 1000);
    assert.equal(precioConPromociones(prenda, [suCategoria], HOY), 500);
  });

  it('respeta el alcance por producto', () => {
    const otroProducto = promo({ valor: 50, productoIds: ['prod-9'] });
    const esteProducto = promo({ valor: 50, productoIds: ['prod-1'] });
    assert.equal(precioConPromociones(prenda, [otroProducto], HOY), 1000);
    assert.equal(precioConPromociones(prenda, [esteProducto], HOY), 500);
  });

  it('parte del precio ya rebajado del producto', () => {
    const rebajada = { ...prenda, precioOferta: 800, ofertaInicio: AYER, ofertaFin: MANANA };
    // 10% sobre 800, no sobre 1000.
    assert.equal(precioConPromociones(rebajada, [promo({ valor: 10 })], HOY), 720);
    assert.equal(descuentoTotalPorcentaje(rebajada, [promo({ valor: 10 })], HOY), 28);
  });

  it('una promoción peor que la oferta del producto no sube el precio', () => {
    const rebajada = { ...prenda, precioOferta: 500, ofertaInicio: AYER, ofertaFin: MANANA };
    assert.equal(precioConPromociones(rebajada, [promo({ valor: 5 })], HOY), 475);
    assert.ok(precioConPromociones(rebajada, [promo({ valor: 5 })], HOY) <= 500);
  });
});

describe('envío por zona', () => {
  it('reconoce la capital escrita de varias formas', () => {
    for (const municipio of ['Tegucigalpa', 'tegucigalpa', 'Distrito Central', 'Comayaguela', 'MDC']) {
      assert.equal(esTegucigalpa('Francisco Morazán', municipio), true, municipio);
    }
  });

  it('no confunde otro municipio del mismo departamento', () => {
    assert.equal(esTegucigalpa('Francisco Morazán', 'Talanga'), false);
  });

  it('no confunde una capital de otro departamento', () => {
    assert.equal(esTegucigalpa('Cortés', 'San Pedro Sula'), false);
  });

  it('cobra 90 en la capital y 120 fuera', () => {
    assert.equal(costoEnvioPara('Francisco Morazán', 'Tegucigalpa'), 90);
    assert.equal(costoEnvioPara('Cortés', 'San Pedro Sula'), 120);
    assert.equal(costoEnvioPara('Islas de la Bahía', 'Roatán'), 120);
  });

  it('usa las tarifas que le pasen, no las fijas', () => {
    const tarifas = { tegucigalpa: 100, nacional: 150 };
    assert.equal(costoEnvioPara('Francisco Morazán', 'Tegucigalpa', tarifas), 100);
    assert.equal(costoEnvioPara('Yoro', 'El Progreso', tarifas), 150);
  });
});

describe('WhatsApp', () => {
  it('agrega el código de país a un número hondureño de 8 dígitos', () => {
    assert.equal(normalizarWhatsApp('8871-2141'), '50488712141');
    assert.equal(normalizarWhatsApp('8871 2141'), '50488712141');
  });

  it('respeta un número que ya trae código de país', () => {
    assert.equal(normalizarWhatsApp('+504 8871 2141'), '50488712141');
  });

  it('sin número no arma enlace', () => {
    assert.equal(normalizarWhatsApp(''), '');
    assert.equal(enlaceWhatsApp('', 'hola'), null);
  });

  it('escapa el mensaje en el enlace', () => {
    const url = enlaceWhatsApp('8871-2141', 'Pedido #1 & talla M');
    assert.ok(url?.startsWith('https://wa.me/50488712141?text='));
    assert.ok(url?.includes('%26'));
  });
});
