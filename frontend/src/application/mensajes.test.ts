import { describe, expect, it } from 'vitest';
import { formatPrice } from '@/lib/format';
import { datosDeCredito, diasHasta, fraseVence, rellenar, EJEMPLO } from './mensajes';

/**
 * LAS MARCAS Y LA FRASE DE VENCIMIENTO.
 *
 * Lo que se prueba aquí es lo que el cliente LEE: si el relleno falla, sale un
 * mensaje con `{saldo}` dentro; si la frase falla, le dice "vence en 5 días" a
 * alguien que ya se pasó.
 */

describe('rellenar', () => {
  it('cambia las cuatro marcas', () => {
    const texto = 'ey {nombre}, tu crédito {vence} — son {saldo}. Pactado el {fecha}.';
    // El saldo se compara contra el formateador real: separa con espacio DURO.
    expect(rellenar(texto, EJEMPLO))
      .toBe(`ey Laura, tu crédito vence en 5 días — son ${formatPrice(137000)}. Pactado el 15/10/2026.`);
  });

  it('una marca repetida se cambia todas las veces', () => {
    expect(rellenar('{nombre}, {nombre}', EJEMPLO)).toBe('Laura, Laura');
  });

  it('lo que no reconoce lo deja tal cual, para que se vea el error', () => {
    expect(rellenar('hola {nombe}', EJEMPLO)).toBe('hola {nombe}');
  });

  it('el saldo trae "$" y no se rompe (replace lo tomaría como grupo)', () => {
    expect(rellenar('debes {saldo}', { ...EJEMPLO, saldo: '$ 1.000' })).toBe('debes $ 1.000');
  });
});

describe('fraseVence', () => {
  it('todavía no llega la fecha', () => {
    expect(fraseVence(0)).toBe('vence hoy');
    expect(fraseVence(1)).toBe('vence mañana');
    expect(fraseVence(5)).toBe('vence en 5 días');
  });

  it('ya se pasó', () => {
    expect(fraseVence(-1)).toBe('venció ayer');
    expect(fraseVence(-3)).toBe('venció hace 3 días');
  });
});

describe('diasHasta', () => {
  it('cuenta días de calendario', () => {
    expect(diasHasta('2026-10-15', '2026-10-10')).toBe(5);
    expect(diasHasta('2026-10-10', '2026-10-10')).toBe(0);
    expect(diasHasta('2026-10-07', '2026-10-10')).toBe(-3);
  });

  it('cruza de mes y de año sin correrse un día', () => {
    expect(diasHasta('2026-11-01', '2026-10-31')).toBe(1);
    expect(diasHasta('2027-01-01', '2026-12-31')).toBe(1);
  });

  it('sin fecha pactada no inventa un número', () => {
    expect(diasHasta(null, '2026-10-10')).toBeNull();
    expect(diasHasta('no es fecha', '2026-10-10')).toBeNull();
  });

  it('el backend la manda como instante ISO: se recorta al día', () => {
    // Sin el recorte salía null y el mensaje decía "sigue pendiente" a alguien
    // con plazo. Lo cazó el recorrido `maestroMensajes.e2e` el 2026-10-04.
    expect(diasHasta('2026-10-15T00:00:00.000Z', '2026-10-10')).toBe(5);
    expect(diasHasta('2026-10-07T00:00:00.000Z', '2026-10-10')).toBe(-3);
  });
});

describe('datosDeCredito', () => {
  const credito = {
    cliente: { nombre: 'Laura Gómez' },
    total_en_deuda: 137000,
    fecha_limite: '2026-10-15',
  };

  it('arma las cuatro marcas de un crédito por vencer', () => {
    expect(datosDeCredito(credito, '2026-10-10')).toEqual({
      nombre: 'Laura', saldo: formatPrice(137000), vence: 'vence en 5 días', fecha: '15/10/2026',
    });
  });

  it('el mismo crédito, ya vencido, cambia la frase y no el resto', () => {
    const d = datosDeCredito(credito, '2026-10-18');
    expect(d.vence).toBe('venció hace 3 días');
    expect(d.saldo).toBe(formatPrice(137000));
  });

  it('sin fecha pactada lo dice en vez de dejar el hueco', () => {
    const d = datosDeCredito({ ...credito, fecha_limite: null }, '2026-10-10');
    expect(d.vence).toBe('sigue pendiente');
    expect(d.fecha).toBe('sin fecha pactada');
  });

  it('con la fecha como instante ISO también sale corta y con su frase', () => {
    const d = datosDeCredito({ ...credito, fecha_limite: '2026-10-15T00:00:00.000Z' }, '2026-10-10');
    expect(d.vence).toBe('vence en 5 días');
    expect(d.fecha).toBe('15/10/2026');
  });
});
