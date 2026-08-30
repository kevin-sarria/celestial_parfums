import { describe, expect, it } from 'vitest';
import { costoDelFrasco, costoPorMl, escalarReceta, saldoDeTanda } from './maceracion.calculo';

/**
 * LA ARITMÉTICA DE MACERAR, contra los números REALES del dueño.
 *
 * Todo lo de aquí está medido sobre su lote del 11 de agosto de 2026 (212 VIP
 * Black, `producciones.id = 1` del respaldo del 2026-08-24): su receta de 100 ml
 * es **mitad esencia** —50 esencia, 48,9 diluyente, 0,8 sellador, 0,3
 * feromonas— y ese lote costó $120.939,78, o sea $24.187,956 por frasco.
 *
 * La prueba que cierra el diseño es la última: **macerar y envasar tiene que
 * costar lo mismo que armar directo**. Si no, el dueño vería un costo distinto
 * según cómo trabajó ese día.
 */

/** La receta de 100 ml del dueño, tal cual está en su base. */
const CIEN_ML = { ml_total: 100, esencia_ml: 50, sellador_ml: 0.8, feromonas_ml: 0.3 };

/**
 * Costos REALES por ml, copiados de los movimientos 287-293 de ese lote. No son
 * cifras de ejemplo: si alguien cambia la aritmética, esta prueba se cae con los
 * números del dueño delante.
 */
const PRECIO = { esencia: 315.9551, diluyente: 18, sellador: 100, feromonas: 100 };
/** Envase 100 ml ($5.000) + bolsa organza ($300) + perfumero ($2.100). */
const EXTRAS_POR_FRASCO = 7400;

describe('escalar la proporción de una receta', () => {
  it('500 ml salen de la receta de 100 ml multiplicada por cinco', () => {
    expect(escalarReceta(CIEN_ML, 500)).toEqual({
      esencia: 250, sellador: 4, feromonas: 1.5, diluyente: 244.5,
    });
  });

  it('los cuatro sumados dan EXACTAMENTE los ml pedidos', () => {
    // El diluyente es el resto, no un escalado propio: así el redondeo no
    // inventa ni pierde líquido. Con 333 ml los factores no son redondos.
    const r = escalarReceta(CIEN_ML, 333);
    expect(r.esencia + r.diluyente + r.sellador + r.feromonas).toBeCloseTo(333, 6);
  });

  it('macerar menos de una talla también reparte bien', () => {
    const r = escalarReceta(CIEN_ML, 30);
    expect(r.esencia).toBe(15);
    expect(r.esencia + r.diluyente + r.sellador + r.feromonas).toBeCloseTo(30, 6);
  });
});

describe('costo del granel', () => {
  it('los 500 ml del lote real cuestan $83.939,78, o sea $167,879 56 por ml', () => {
    const r = escalarReceta(CIEN_ML, 500);
    const total = r.esencia * PRECIO.esencia + r.diluyente * PRECIO.diluyente
      + r.sellador * PRECIO.sellador + r.feromonas * PRECIO.feromonas;

    expect(Math.round(total * 100) / 100).toBe(83939.78);
    expect(costoPorMl(83939.78, 500)).toBe(167.87956);
  });

  it('sin ml no divide por cero: devuelve cero', () => {
    expect(costoPorMl(1000, 0)).toBe(0);
  });
});

describe('macerar + envasar cuesta lo MISMO que armar directo', () => {
  it('reproduce los $24.187,956 por frasco del lote real', () => {
    // Camino nuevo: 500 ml macerados y luego 5 frascos de 100 ml.
    const costoMl = costoPorMl(83939.78, 500);
    const porFrasco = costoDelFrasco(costoMl, 100, EXTRAS_POR_FRASCO);

    expect(porFrasco).toBe(24187.956);

    // Camino viejo: la receta de 100 ml descontada cinco veces, de una.
    const unaTalla = escalarReceta(CIEN_ML, 100);
    const directo = unaTalla.esencia * PRECIO.esencia + unaTalla.diluyente * PRECIO.diluyente
      + unaTalla.sellador * PRECIO.sellador + unaTalla.feromonas * PRECIO.feromonas
      + EXTRAS_POR_FRASCO;

    // Es LA igualdad que sostiene el diseño entero.
    expect(porFrasco).toBeCloseTo(directo, 2);
    expect(Math.round(porFrasco * 5 * 100) / 100).toBe(120939.78);
  });

  it('envasar en tallas distintas del mismo granel reparte el costo por ml', () => {
    const costoMl = costoPorMl(83939.78, 500);
    // Un frasco de 30 ml lleva tres décimas del líquido de uno de 100.
    expect(costoDelFrasco(costoMl, 30, 0) * (100 / 30)).toBeCloseTo(costoDelFrasco(costoMl, 100, 0), 2);
  });
});

describe('saldo de la tanda', () => {
  it('descuenta lo envasado, en las tallas que sea', () => {
    // 3 × 30 ml + 2 × 100 ml de una tanda de 500 → quedan 210.
    expect(saldoDeTanda(500, [{ cantidad: 3, ml: 30 }, { cantidad: 2, ml: 100 }])).toBe(210);
  });

  it('la merma de cerrar la tanda también sale del saldo', () => {
    expect(saldoDeTanda(500, [{ cantidad: 4, ml: 100 }], 100)).toBe(0);
  });

  it('envasar de más deja el saldo NEGATIVO, no en cero', () => {
    // No se bloquea: se avisa. Un saldo negativo a la vista es mejor que
    // bloquear a alguien un martes por la noche por haber medido a ojo.
    expect(saldoDeTanda(500, [{ cantidad: 6, ml: 100 }])).toBe(-100);
  });

  it('sin envasados, el saldo es lo que se puso', () => {
    expect(saldoDeTanda(500, [])).toBe(500);
  });
});
