import { describe, expect, it } from 'vitest';
import { agregarLinea, describirCambios, type FotoLote } from './producciones.historial';

const base: FotoLote = {
  fecha: '2026-08-21', cantidad: 3, perfume: 'Khamrah By Lattafa', volumen: '100 ML',
  envase: 'Envase Khamrah 1.1 100ml', costo_unitario: 70000, costo_manual: false,
};

describe('la frase del historial', () => {
  it('junta los cambios con · y en español', () => {
    const texto = describirCambios(base, { ...base, cantidad: 5, perfume: 'Khamrah 1.1' });
    expect(texto).toBe('3 → 5 unidades · ficha Khamrah By Lattafa → Khamrah 1.1');
  });

  it('marca el costo puesto a mano con su valor en pesos', () => {
    const texto = describirCambios(base, { ...base, costo_unitario: 74580, costo_manual: true });
    expect(texto).toBe('costo $74.580 puesto a mano');
  });

  it('no inventa cambios cuando no cambió nada', () => {
    expect(describirCambios(base, { ...base })).toBe('');
  });

  it('dice el envase y la fecha cuando se corrigen', () => {
    const texto = describirCambios(base, { ...base, fecha: '2026-08-22', envase: 'Envase 100 ml' });
    expect(texto).toBe('fecha 2026-08-21 → 2026-08-22 · envase Envase Khamrah 1.1 100ml → Envase 100 ml');
  });

  it('pone la línea nueva primero y aguanta un historial vacío o corrupto', () => {
    const uno = agregarLinea(null, '2026-08-25', 'primera');
    const dos = agregarLinea(uno, '2026-08-26', 'segunda');
    expect(dos.map((l) => l.texto)).toEqual(['segunda', 'primera']);
    expect(agregarLinea('no soy json', '2026-08-25', 'sola')).toHaveLength(1);
  });
});
