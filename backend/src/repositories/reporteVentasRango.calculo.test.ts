import { describe, expect, it } from 'vitest';
import {
  mesesDelRango, resumirCompras, resumirPerdidas, resumirVentas, type VentaFila,
} from './reporteVentasRango.calculo';

const dia = (s: string) => new Date(`${s}T00:00:00Z`);
let n = 0;
const venta = (v: Partial<VentaFila>): VentaFila => ({
  id: ++n, dia: dia('2026-09-10'), persona: 'X', valor: 100000, pagada: true,
  costo: 40000, unidades: 1, regalos: 0, abonado: null, ...v,
});

describe('resumirVentas', () => {
  it('vendido es SOLO lo pagado por completo; lo demás es deuda', () => {
    const r = resumirVentas([
      venta({ valor: 100000 }),
      venta({ valor: 60000, pagada: false }), // contado sin pagar
      venta({ valor: 240000, pagada: false, abonado: 50000 }), // crédito abonado
    ]);
    expect(r.vendido).toBe(100000);
    expect(r.num_ventas).toBe(1);
    expect(r.en_deuda).toBe(60000 + 190000);
    expect(r.num_en_deuda).toBe(2);
  });

  it('ganancia y margen sobre las ventas con costo', () => {
    const r = resumirVentas([venta({ valor: 100000, costo: 40000 }), venta({ valor: 50000, costo: 30000 })]);
    expect(r.costo).toBe(70000);
    expect(r.ganancia).toBe(80000);
    expect(r.margen_pct).toBe(53.3); // 80.000 / 150.000
  });

  it('sin costo registrado: "sin datos" (null), nunca una ganancia del 100 %', () => {
    const r = resumirVentas([venta({ costo: 0 }), venta({ costo: 0 })]);
    expect(r.vendido).toBe(200000);
    expect(r.costo).toBeNull();
    expect(r.ganancia).toBeNull();
    expect(r.margen_pct).toBeNull();
    expect(r.sin_costo).toEqual({ num: 2, valor: 200000 });
  });

  it('mezcla: la ganancia se mide solo con las que tienen costo y dice cuántas faltan', () => {
    const r = resumirVentas([venta({ valor: 100000, costo: 40000 }), venta({ valor: 80000, costo: 0 })]);
    expect(r.vendido).toBe(180000);
    expect(r.ganancia).toBe(60000);
    expect(r.sin_costo).toEqual({ num: 1, valor: 80000 });
    expect(r.cobertura_pct).toBe(56); // 100.000 de 180.000
  });

  it('unidades y regalos cuentan solo lo pagado; las de deuda van aparte', () => {
    const r = resumirVentas([
      venta({ unidades: 3, regalos: 1 }),
      venta({ unidades: 2, pagada: false }),
    ]);
    expect(r.unidades).toBe(3);
    expect(r.regalos).toBe(1);
    expect(r.unidades_en_deuda).toBe(2);
  });
});

describe('resumirPerdidas', () => {
  it('suma cada causa y deja las muestras FUERA del total', () => {
    const r = resumirPerdidas(
      [
        { fecha: dia('2026-09-01'), tipo: 'merma', valor: 10000 },
        { fecha: dia('2026-09-02'), tipo: 'ajuste', valor: 5000 },
        { fecha: dia('2026-09-03'), tipo: 'garantia', valor: 20000 },
        { fecha: dia('2026-09-04'), tipo: 'muestra', valor: 7000 },
      ],
      [{ fecha: dia('2026-09-05'), monto: 30000 }],
      [venta({ valor: 30000, costo: 45000 })],
    );
    expect(r.ventas_bajo_costo).toBe(15000);
    expect(r.detalle_bajo_costo).toHaveLength(1);
    expect(r.total).toBe(10000 + 5000 + 20000 + 30000 + 15000);
    expect(r.muestras).toBe(7000);
  });
});

describe('resumirCompras', () => {
  it('lo invertido son las compras más sus envíos', () => {
    expect(resumirCompras([{ dia: dia('2026-09-01'), valor: 1000000, envio: 50000 }]))
      .toEqual({ num: 1, compras: 1000000, envios: 50000, total: 1050000 });
  });
});

describe('mesesDelRango', () => {
  it('todos los meses que toca, aunque el rango empiece y termine a mitad de mes', () => {
    expect(mesesDelRango(dia('2026-07-15'), dia('2026-09-03'))).toEqual(['2026-07', '2026-08', '2026-09']);
  });
  it('cruza el año', () => {
    expect(mesesDelRango(dia('2025-12-20'), dia('2026-01-05'))).toEqual(['2025-12', '2026-01']);
  });
});
