import { describe, expect, it } from 'vitest';
import { filtroEnum, filtroFecha, filtroNumero, filtroTexto, parseFiltros } from './filtros';

const mapa = {
  persona: filtroTexto('persona'),
  valor_venta: filtroNumero('valor_venta'),
  dia: filtroFecha('dia'),
  pagada: filtroEnum('pagada'),
};

describe('parseFiltros', () => {
  it('sin ?filtros= no arma condiciones', () => {
    expect(parseFiltros({}, mapa)).toBeUndefined();
  });

  it('un JSON roto se ignora, no revienta la lista', () => {
    expect(parseFiltros({ filtros: '{no es json' }, mapa)).toBeUndefined();
  });

  it('una columna que no está en el mapa se ignora sola', () => {
    const filtros = JSON.stringify({ columna_inventada: { type: 'string', op: 'contains', value: 'x' } });
    expect(parseFiltros({ filtros }, mapa)).toBeUndefined();
  });

  it('texto: contiene / es igual / empieza con', () => {
    const filtros = JSON.stringify({ persona: { type: 'string', op: 'contains', value: 'kevin' } });
    expect(parseFiltros({ filtros }, mapa)).toEqual([{ persona: { contains: 'kevin' } }]);
  });

  it('número: mayor y menor que', () => {
    const gt = JSON.stringify({ valor_venta: { type: 'currency', op: 'gt', value: '50000' } });
    expect(parseFiltros({ filtros: gt }, mapa)).toEqual([{ valor_venta: { gt: 50000 } }]);
  });

  it('número con texto no numérico se ignora', () => {
    const filtros = JSON.stringify({ valor_venta: { type: 'currency', op: 'eq', value: 'no es número' } });
    expect(parseFiltros({ filtros }, mapa)).toBeUndefined();
  });

  it('fecha: antes de', () => {
    const filtros = JSON.stringify({ dia: { type: 'date', op: 'before', value: '2026-08-14' } });
    const cond = parseFiltros({ filtros }, mapa);
    expect(cond).toEqual([{ dia: { lt: new Date('2026-08-14') } }]);
  });

  it('enum: varios valores marcados', () => {
    const filtros = JSON.stringify({ pagada: { type: 'enum', values: ['Pagada'] } });
    expect(parseFiltros({ filtros }, mapa)).toEqual([{ pagada: { in: ['Pagada'] } }]);
  });

  it('varias columnas a la vez arman varias condiciones', () => {
    const filtros = JSON.stringify({
      persona: { type: 'string', op: 'contains', value: 'ana' },
      valor_venta: { type: 'currency', op: 'gt', value: '10000' },
    });
    expect(parseFiltros({ filtros }, mapa)).toEqual([
      { persona: { contains: 'ana' } },
      { valor_venta: { gt: 10000 } },
    ]);
  });

  it('un valor vacío no arma condición para esa columna', () => {
    const filtros = JSON.stringify({ persona: { type: 'string', op: 'contains', value: '   ' } });
    expect(parseFiltros({ filtros }, mapa)).toBeUndefined();
  });
});
