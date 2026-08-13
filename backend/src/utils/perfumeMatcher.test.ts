import { describe, it, expect } from 'vitest';
import { buildPerfumeIndex, matchPerfume, matchPerfumes, agruparEnlaces, normalizeName } from './perfumeMatcher';

/**
 * El matcher decide a qué perfume del catálogo apunta el texto libre de una
 * venta. Su regla de oro es ser CONSERVADOR: ante dos candidatos no elige
 * ninguno.
 *
 * Por qué importa tanto: de ese enlace depende qué esencia se descuenta del
 * inventario y con qué costo se valora la venta. Un enlace equivocado no da
 * error — descuenta la fragancia que no era y falsea la ganancia del mes en
 * silencio. Por eso "no enlazar" es un fallo barato y "enlazar mal" es caro.
 */

const catalogo = (...nombres: string[]) =>
  buildPerfumeIndex(nombres.map((nombre, i) => ({ id: i + 1, nombre })));

describe('normalizeName', () => {
  it('quita tildes, mayúsculas y puntuación', () => {
    expect(normalizeName('Acqua di Gió — PROFUMO')).toBe('acqua di gio profumo');
  });
});

describe('matchPerfume — enlaza solo cuando no hay duda', () => {
  it('enlaza por nombre exacto', () => {
    const idx = catalogo('Eros', 'Sauvage');
    expect(matchPerfume('Eros', idx)).toBe(1);
  });

  it('ignora mayúsculas, tildes y la talla pegada al nombre', () => {
    const idx = catalogo('Acqua di Gio');
    expect(matchPerfume('ACQUA DI GIÓ 30ml', idx)).toBe(1);
  });

  it('enlaza cuando la referencia está CONTENIDA en el nombre del catálogo', () => {
    const idx = catalogo('Bade Al Oud Sublime', 'Eros');
    expect(matchPerfume('sublime', idx)).toBe(1);
  });

  it('NO elige cuando hay dos candidatos posibles', () => {
    // El caso real de CLAUDE.md: "One Million" con solo variantes en catálogo.
    const idx = catalogo('1 Million Elixir', '1 Million Parfum');
    expect(matchPerfume('One Million', idx)).toBeNull();
  });

  it('sí enlaza "One Million" cuando ese nombre exacto SÍ existe', () => {
    const idx = catalogo('1 Million', '1 Million Elixir');
    expect(matchPerfume('One Million', idx)).toBe(1);
  });

  it('devuelve null si la referencia no dice nada útil', () => {
    expect(matchPerfume('30 ml', catalogo('Eros'))).toBeNull();
    expect(matchPerfume('', catalogo('Eros'))).toBeNull();
  });

  describe('alias de grafías vistas en el Excel histórico', () => {
    it('trata "one" y "uno" como "1"', () => {
      expect(matchPerfume('uno million', catalogo('1 Million'))).toBe(1);
    });

    it('trata "aqua" como "acqua"', () => {
      expect(matchPerfume('Aqua di Gio', catalogo('Acqua di Gio'))).toBe(1);
    });
  });

  describe('tolerancia a errores de tecleo, con cinturones', () => {
    it('perdona UNA letra en palabras largas', () => {
      expect(matchPerfume('Sauvaje', catalogo('Sauvage'))).toBe(1);
    });

    it('NO perdona nada en palabras cortas: "men" y "212" no son typos', () => {
      // Sin este cinturón, "360 Men" enlazaría con "360 Red" y descontaría la
      // esencia de otra fragancia.
      const idx = catalogo('360 Red');
      expect(matchPerfume('360 Men', idx)).toBeNull();
    });
  });
});

describe('matchPerfumes — una venta de combo nombra varios perfumes', () => {
  it('enlaza cada parte cuando hay separadores', () => {
    const idx = catalogo('Invictus', 'Sauvage', '1 Million');
    expect(matchPerfumes('invictus, sauvage y 1 million', idx)).toEqual([1, 2, 3]);
  });

  it('CONSERVA los repetidos: son unidades, no un error', () => {
    // "360 Men, 360 Men, Eros" son 2 unidades del primero. Deduplicar aquí
    // perdería una unidad de la venta.
    const idx = catalogo('360 Men', 'Eros');
    expect(matchPerfumes('360 Men, 360 Men, Eros', idx)).toEqual([1, 1, 2]);
  });

  it('omite las partes que no reconoce, sin descartar las demás', () => {
    const idx = catalogo('Eros');
    expect(matchPerfumes('Eros, algo que no existe', idx)).toEqual([1]);
  });

  /**
   * Caso real del catálogo: el perfume 603 se llama "Thank U, Next By Ariana
   * Grande". Al partir por la coma, las dos mitades enlazaban con ÉL MISMO y la
   * venta quedaba con cantidad 2 — el doble de esencia descontada.
   *
   * Encontrado por esta prueba el 2026-08-12 y corregido el mismo día.
   */
  it('un nombre que lleva coma NO se cuenta dos veces', () => {
    const idx = catalogo('Thank U, Next By Ariana Grande', 'Eros');
    expect(matchPerfumes('Thank U, Next By Ariana Grande', idx)).toEqual([1]);
  });

  it('el arreglo exige nombre EXACTO, no que uno contenga al otro', () => {
    // Con contención, "Eros" se comería una venta de "Eros, Sauvage".
    const idx = catalogo('Eros', 'Sauvage');
    expect(matchPerfumes('Eros, Sauvage', idx)).toEqual([1, 2]);
  });

  it('devuelve lista vacía cuando no reconoce nada', () => {
    expect(matchPerfumes('xyz', catalogo('Eros'))).toEqual([]);
  });
});

describe('agruparEnlaces — de ids repetidos a cantidades', () => {
  it('cuenta las repeticiones', () => {
    expect(agruparEnlaces([1, 1, 2])).toEqual([
      { perfume_id: 1, cantidad: 2 },
      { perfume_id: 2, cantidad: 1 },
    ]);
  });

  it('una lista vacía no produce enlaces', () => {
    expect(agruparEnlaces([])).toEqual([]);
  });
});
