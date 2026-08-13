import { describe, expect, it } from 'vitest';
import type { Insumo } from './cotizacion.types';
import { esEsencia } from './insumo';

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
