import { describe, it, expect } from 'vitest';
import { mlDelNombre } from './tallas';

/**
 * ¿Cuántos mililitros son una talla llamada "90 ML"?
 *
 * La talla dejó de ser texto el 2026-08-01: el catálogo y el costeo se enlazan
 * POR NÚMERO. Una talla sin `ml` el sistema la trata como "no es un tamaño" y
 * **no la costea**, así que una talla nueva que nazca sin número es una venta
 * cuyo costo entra en cero.
 *
 * El corte es EL MISMO de la migración `20260801140000_tallas_en_ml`
 * (`^[0-9]+ *[mM][lL]`), a propósito: dos formas de leer el mismo nombre
 * acabarían dando dos números distintos para la misma talla.
 */

describe('mlDelNombre', () => {
  it('lee el número de las formas en que el dueño las escribe', () => {
    expect(mlDelNombre('30ml')).toBe(30);
    expect(mlDelNombre('50 ML')).toBe(50);
    expect(mlDelNombre('100 ml')).toBe(100);
    // Las que necesita para cargar los originales, que hoy no existen.
    expect(mlDelNombre('90 ML')).toBe(90);
    expect(mlDelNombre('125ML')).toBe(125);
  });

  it('un nombre con espacios de sobra sigue siendo la misma talla', () => {
    expect(mlDelNombre('  60 ml  ')).toBe(60);
  });

  it('lo que NO es un tamaño se queda sin número, a propósito', () => {
    // "200/250ML" es un apaño para marcar splash de 200 Y de 250: hay que
    // separarlas a mano en dos tallas reales, no adivinar cuál de las dos es.
    expect(mlDelNombre('200/250ML')).toBe(null);
    expect(mlDelNombre('Combo Personalizado')).toBe(null);
    expect(mlDelNombre('')).toBe(null);
  });

  it('el número tiene que ir DELANTE, como en la migración', () => {
    // "ML 30" no se lee: si se aceptara, este corte y el de la migración
    // dirían cosas distintas sobre los mismos nombres.
    expect(mlDelNombre('ML 30')).toBe(null);
    expect(mlDelNombre('Perfumero de 6 ml')).toBe(null);
  });
});
