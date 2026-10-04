import { describe, expect, it } from 'vitest';
import { regaloDeEmpaque } from './regaloDeEmpaque';

describe('regaloDeEmpaque', () => {
  it('cubre lo regalado hasta lo que le toca al pedido; lo de más queda como regalo de verdad', () => {
    expect(regaloDeEmpaque([{ perfume_id: 1, regalo: 3 }], new Map([[1, 1]]))).toEqual([1]);
  });

  it('dos líneas del mismo accesorio comparten el cupo, no lo duplican', () => {
    expect(regaloDeEmpaque([{ perfume_id: 1, regalo: 1 }, { perfume_id: 1, regalo: 1 }], new Map([[1, 1]]))).toEqual([1, 0]);
  });

  it('un perfume regalado nunca es empaque', () => {
    expect(regaloDeEmpaque([{ perfume_id: 9, regalo: 1 }], new Map([[1, 2]]))).toEqual([0]);
  });
});
