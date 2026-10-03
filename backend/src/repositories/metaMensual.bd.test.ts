import { beforeEach, describe, expect, it } from 'vitest';
import { limpiarBase } from '../test/baseDePrueba';
import { metaDelMes, ponerMeta } from './metaMensual';

const DIA = new Date(Date.UTC(2026, 9, 2)); // 2 de octubre de 2026

describe('la meta del mes', () => {
  beforeEach(limpiarBase);

  it('sin meta, propone la del último mes que tuvo; con meta, la dice', async () => {
    await ponerMeta('2026-08', 2_500_000);
    let m = await metaDelMes(DIA);
    expect(m).toMatchObject({ mes: '2026-10', monto: null, sugerida: 2_500_000, dia: 2, dias_del_mes: 31 });

    await ponerMeta('2026-10', 3_000_000);
    m = await metaDelMes(DIA);
    expect(m.monto).toBe(3_000_000);
  });

  it('cambiarla la reemplaza, y 0 la quita', async () => {
    await ponerMeta('2026-10', 3_000_000);
    await ponerMeta('2026-10', 3_500_000);
    expect((await metaDelMes(DIA)).monto).toBe(3_500_000);
    await ponerMeta('2026-10', 0);
    expect((await metaDelMes(DIA)).monto).toBeNull();
  });

  it('rechaza un mes o un monto que no lo son', async () => {
    await expect(ponerMeta('octubre', 1000)).rejects.toThrow(/AAAA-MM/);
    await expect(ponerMeta('2026-10', -5)).rejects.toThrow(/pesos/);
  });
});
