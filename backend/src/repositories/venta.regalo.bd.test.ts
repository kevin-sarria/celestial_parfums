import { beforeEach, describe, expect, it } from 'vitest';
import { createVentaSchema, lineasDeVenta } from '../schemas/venta.schema';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { createVenta } from './venta.repository';

/**
 * `venta_perfume.regalo`: cuántas unidades de una línea van sin cobrar.
 * Nunca mayor que `cantidad` — se valida en el esquema, no solo en la
 * pantalla (decidido en el diseño del 2026-08-18).
 *
 * La otra mitad de la regla, y la que hace que la ganancia del mes no salga
 * inflada: el inventario descuenta la cantidad COMPLETA. Lo regalado también
 * salió de la bodega.
 */

describe('regalo por línea', () => {
  beforeEach(limpiarBase);

  it('el esquema rechaza un regalo mayor que la cantidad', () => {
    const resultado = createVentaSchema.safeParse({
      dia: '2026-08-20', persona: 'Prueba', cantidad_perfumes: 2,
      lineas: [{ perfume_id: 1, ml: 30, cantidad: 2, regalo: 3 }],
      valor_venta: 10000,
    });
    expect(resultado.success).toBe(false);
  });

  it('el esquema acepta regalo igual a la cantidad (100% gratis)', () => {
    const resultado = createVentaSchema.safeParse({
      dia: '2026-08-20', persona: 'Prueba', cantidad_perfumes: 2,
      lineas: [{ perfume_id: 1, ml: 30, cantidad: 2, regalo: 2 }],
      valor_venta: 10000,
    });
    expect(resultado.success).toBe(true);
  });

  it('agrupar dos líneas del mismo producto suma cantidad y regalo por separado', () => {
    const parsed = createVentaSchema.parse({
      dia: '2026-08-20', persona: 'Prueba', cantidad_perfumes: 3,
      lineas: [
        { perfume_id: 1, ml: 30, cantidad: 1, regalo: 0 },
        { perfume_id: 1, ml: 30, cantidad: 2, regalo: 1 },
      ],
      valor_venta: 10000,
    });
    expect(lineasDeVenta(parsed)).toEqual([{ perfume_id: 1, ml: 30, cantidad: 3, regalo: 1 }]);
  });

  it('una venta guardada con regalo lo conserva y el inventario descuenta la cantidad completa', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const antes = await estadoDe(s.frasco.id);

    const venta = await createVenta({
      dia: '2026-08-20', persona: 'Prueba', cantidad_perfumes: 2, presentacion: '30ML',
      perfume_ids: [], user_id: null,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 2, regalo: 1 }],
      valor_venta: 60000,
    });

    expect(venta.perfumes[0].cantidad).toBe(2);
    expect(venta.perfumes[0].regalo).toBe(1);

    // Se cobró 1 frasco, pero salieron DOS de la bodega: el regalado también.
    const despues = await estadoDe(s.frasco.id);
    expect(antes.stock - despues.stock).toBe(2);
  });
});
