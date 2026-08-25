import { describe, expect, it } from 'vitest';
import type { Insumo } from './cotizacion.types';
import { esEsencia, opcionesPorExistencias, type MaterialOfrecible } from './insumo';

/**
 * Qué cuenta como esencia. De esto depende qué materiales se pueden elegir al
 * decirle a un perfume con qué se hace — y si no aparece, ese perfume no
 * descuenta nada al venderse y su costo entra en cero.
 */

const material = (extra: Partial<Insumo>): Pick<Insumo, 'tipo' | 'gama_id'> => ({
  tipo: 'materia_prima',
  gama_id: null,
  ...extra,
});

describe('esEsencia', () => {
  it('una materia prima CON gama es una esencia', () => {
    expect(esEsencia(material({ gama_id: 2 }))).toBe(true);
  });

  it('el diluyente, el sellador y las feromonas NO lo son, aunque sean materia prima', () => {
    // Son los tres materiales generales de la receta: no tienen gama y no se
    // pueden elegir como "la esencia de este perfume".
    expect(esEsencia(material({ gama_id: null }))).toBe(false);
  });

  it('un envase nunca es una esencia, tenga lo que tenga', () => {
    expect(esEsencia(material({ tipo: 'envase', gama_id: 3 }))).toBe(false);
    expect(esEsencia(material({ tipo: 'accesorio', gama_id: 3 }))).toBe(false);
  });

  /**
   * El caso que motivó el cambio, con nombres reales del inventario del dueño.
   * Antes se miraba el nombre, así que estas tres —clasificadas como árabes y
   * con stock— no aparecían en el formulario del perfume.
   */
  it('una esencia que NO lleva la palabra "esencia" en el nombre sigue siendo esencia', () => {
    for (const gama_id of [1, 2, 3]) {
      expect(esEsencia(material({ gama_id }))).toBe(true);
    }
  });

  it('el nombre no interviene: no se mira', () => {
    // La firma ni siquiera lo pide. Es la garantía de que nadie vuelva a
    // colgarlo de una palabra dentro del texto.
    expect(Object.keys(material({ gama_id: 1 }))).toEqual(['tipo', 'gama_id']);
  });
});

/**
 * Cómo se OFRECE un material en un desplegable que va a consumirlo.
 *
 * El dueño lo encontró el 2026-08-23 registrando una producción: los 5 envases
 * 1.1 estaban en cero y aparecían mezclados con los demás, como si hubiera. Ya
 * había costado antes —el Perfumero Recargable quedó en −25 unidades porque
 * salieron 25 que nunca entraron—, así que la lista tiene que decir la verdad
 * ANTES del clic, no después.
 */

const enBodega = (extra: Partial<MaterialOfrecible>): MaterialOfrecible => ({
  id: 1, nombre: 'Envase 100 ml', stock: 10, activo: true, ...extra,
});

describe('opcionesPorExistencias', () => {
  it('los que tienen existencias van primero y los de cero, al final', () => {
    const opciones = opcionesPorExistencias([
      enBodega({ id: 1, nombre: 'Envase 1.1 100ml', stock: 0 }),
      enBodega({ id: 2, nombre: 'Envase 100 ml', stock: 24 }),
      enBodega({ id: 3, nombre: 'Envase 50 ml', stock: 7 }),
    ]);

    expect(opciones.map((o) => o.id)).toEqual([2, 3, 1]);
  });

  it('el que está en cero se ofrece en gris y dice por qué', () => {
    const [opcion] = opcionesPorExistencias([enBodega({ stock: 0 })]);

    expect(opcion.atenuada).toBe(true);
    expect(opcion.nota).toBe('sin existencias');
  });

  it('el que sí tiene enseña cuántos quedan, para no ir a mirarlo a otra pantalla', () => {
    const [opcion] = opcionesPorExistencias([enBodega({ stock: 24 })]);

    expect(opcion.atenuada).toBeFalsy();
    expect(opcion.nota).toBe('quedan 24');
  });

  it('un stock NEGATIVO es "sin existencias", no "quedan -25"', () => {
    // El Perfumero Recargable, tal cual está hoy en el inventario del dueño.
    const [opcion] = opcionesPorExistencias([
      enBodega({ nombre: 'Perfumero Recargable', stock: -25 }),
    ]);

    expect(opcion.nota).toBe('sin existencias');
    expect(opcion.atenuada).toBe(true);
  });

  it('un material jubilado no se ofrece, tenga lo que tenga', () => {
    const opciones = opcionesPorExistencias([
      enBodega({ id: 1, activo: false, stock: 40 }),
      enBodega({ id: 2, activo: true, stock: 3 }),
    ]);

    expect(opciones.map((o) => o.id)).toEqual([2]);
  });

  it('entre los que tienen existencias se respeta el orden que traía la lista', () => {
    // Ordenar por cantidad pondría el más abundante arriba, y el dueño busca
    // por nombre: la lista llega ya ordenada como él la lee.
    const opciones = opcionesPorExistencias([
      enBodega({ id: 1, nombre: 'Aa', stock: 2 }),
      enBodega({ id: 2, nombre: 'Bb', stock: 99 }),
    ]);

    expect(opciones.map((o) => o.id)).toEqual([1, 2]);
  });

  it('el nombre viaja limpio: la nota va aparte, no pegada al texto', () => {
    const [opcion] = opcionesPorExistencias([
      enBodega({ nombre: 'Envase Khamrah 1.1 100ml', stock: 0 }),
    ]);

    expect(opcion.nombre).toBe('Envase Khamrah 1.1 100ml');
  });
});
