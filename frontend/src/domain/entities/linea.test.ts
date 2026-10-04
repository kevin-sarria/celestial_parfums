import { describe, expect, it } from 'vitest';
import { etiquetaTalla, textoIncluye } from './linea';

/**
 * En un original, "5ML" y "100ML" no dicen lo que importa: que uno es un
 * decant y el otro la botella cerrada (dueño, 2026-09-29).
 */
describe('cómo se llama una talla para el cliente', () => {
  it('en un original distingue el decant de la botella completa', () => {
    expect(etiquetaTalla('original', { presentacion: '5ML', ml: 5, botella_completa: false })).toBe('Decant 5 ml');
    expect(etiquetaTalla('original', { presentacion: '100ML', ml: 100, botella_completa: true })).toBe('Botella 100 ml');
  });

  it('en lo demás deja la etiqueta de siempre', () => {
    expect(etiquetaTalla('contratipo', { presentacion: '100ML', ml: 100, botella_completa: false })).toBe('100ML');
    expect(etiquetaTalla('original', { presentacion: 'Combo Personalizado', ml: null, botella_completa: false }))
      .toBe('Combo Personalizado');
  });
});

describe('textoIncluye', () => {
  it('dice lo que se regala, en minúscula y con "y" al final', () => {
    expect(textoIncluye([{ nombre: 'Bolsa Organza', cantidad: 1 }, { nombre: 'Perfumero recargable 6 ml', cantidad: 1 }]))
      .toBe('Incluye bolsa organza y perfumero recargable 6 ml');
    expect(textoIncluye([{ nombre: 'Perfumero', cantidad: 2 }])).toBe('Incluye 2 × perfumero');
  });

  it('sin nada, no dice nada', () => {
    expect(textoIncluye([])).toBe('');
    expect(textoIncluye(undefined)).toBe('');
  });
});
