import { describe, expect, it } from 'vitest';
import { costoDeTalla } from './costoTalla';

/** Una botella de 100 ml que costó $200.000: $2.000 el ml. */
const botella = { mlBotella: 100, costoMl: 2000 };

describe('costoDeTalla', () => {
  it('un decant: su líquido, los 2 ml que se pierden al trasvasar, su frasco y su empaque', () => {
    const c = costoDeTalla({ ml: 5, ...botella, frasco: 1500, empaque: 300 });
    expect(c).toEqual({ liquido: 10000, merma: 4000, frasco: 1500, empaque: 300, total: 15800 });
  });

  it('la botella completa sale cerrada: sin merma y sin frasco', () => {
    const c = costoDeTalla({ ml: 100, ...botella, frasco: 1500, empaque: 0 });
    expect(c).toEqual({ liquido: 200000, merma: 0, frasco: 0, empaque: 0, total: 200000 });
  });

  it('sin saber cuánto costó la botella no hay costo (no se sugiere nada)', () => {
    expect(costoDeTalla({ ml: 5, mlBotella: 100, costoMl: 0, frasco: 1500, empaque: 0 })).toBeNull();
  });
});
