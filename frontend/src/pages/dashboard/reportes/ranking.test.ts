import { describe, expect, it } from 'vitest';
import { partirRanking, porcentajeTexto, TOPE_POR_DEFECTO } from './ranking';

/**
 * EL CORTE DE LA COLA Y EL PORCENTAJE.
 *
 * Sin el corte, un reporte con 127 insumos pinta 127 filas (medido en el
 * respaldo del 2026-10-04). Sin el porcentaje, el dueño ve la barra pero no
 * puede decir "esto es el 41 % de lo que gasté".
 */
const filas = [100, 50, 25, 12, 6, 3, 2, 1, 1, 1, 1].map((valor, i) => ({ nombre: `f${i}`, valor }));

describe('partirRanking', () => {
  it('corta la cola y la agrupa en una sola fila', () => {
    const r = partirRanking(filas, 8);
    expect(r.visibles).toHaveLength(8);
    expect(r.cola).toEqual({ cuantas: 3, total: 3 });
  });

  it('si la lista cabe entera, no inventa la fila "Otros"', () => {
    expect(partirRanking(filas.slice(0, 5), 8).cola).toBeNull();
  });

  it('el mayor manda la escala de la barra', () => {
    expect(partirRanking(filas, 8).mayor).toBe(100);
  });

  it('el total suma TODAS las filas, no solo las visibles', () => {
    expect(partirRanking(filas, 8).total).toBe(202);
  });

  it('usa 8 por defecto', () => {
    expect(partirRanking(filas).visibles).toHaveLength(TOPE_POR_DEFECTO);
  });

  it('con la lista vacía no revienta ni divide entre cero', () => {
    expect(partirRanking([], 8)).toMatchObject({ visibles: [], cola: null, total: 0, mayor: 1 });
  });

  it('con puras filas en cero no divide entre cero', () => {
    expect(partirRanking([{ nombre: 'a', valor: 0 }], 8).mayor).toBe(1);
  });
});

describe('porcentajeTexto', () => {
  it('un decimal, en formato colombiano', () => {
    expect(porcentajeTexto(387, 1000)).toBe('38,7 %');
  });

  it('lo que no llega al 0,1 % no se pinta como 0 %', () => {
    expect(porcentajeTexto(0.4, 1000)).toBe('<0,1 %');
  });

  it('sin total no divide entre cero', () => {
    expect(porcentajeTexto(10, 0)).toBe('0 %');
  });
});
