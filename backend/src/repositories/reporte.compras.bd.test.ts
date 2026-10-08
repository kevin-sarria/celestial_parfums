import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { reporteCompras } from './reporte.repository';

describe('reporteCompras — familias y facturas sin detalle', () => {
  beforeEach(limpiarBase);

  it('agrega la familia "Sin detalle (facturas sin líneas)" cuando las facturas superan lo detallado', async () => {
    const empresa = await prisma.empresa.create({ data: { nombre: 'Proveedor Test' } });
    const esencia = await crearInsumo('Esencia Test Reporte', { precio: 500, stock: 0 });

    // Factura por $100.000
    await prisma.pagoProveedor.create({
      data: { dia: new Date(), empresa_id: empresa.id, valor_compra: 100000, coste_envio: 10000 },
    });

    // Solo se detallaron líneas por $40.000
    await prisma.movimientoInventario.create({
      data: { insumo_id: esencia.id, tipo: 'compra', cantidad: 80, costo_unitario: 500, fecha: new Date() },
    });

    const rep = await reporteCompras(12);

    expect(rep.total_gastado).toBe(110000);
    expect(rep.total_envios).toBe(10000);

    const sinDetalle = rep.por_familia.find((f) => f.nombre === 'Sin detalle (facturas sin líneas)');
    expect(sinDetalle).toBeDefined();
    // $100.000 mercancía - $40.000 detallado = $60.000 sin detalle
    expect(sinDetalle?.total).toBe(60000);
    expect(sinDetalle?.materiales).toBe(0);

    // La suma de las familias explica exactamente el 100 % de la mercancía ($100.000)
    const sumaFamilias = rep.por_familia.reduce((s, f) => s + f.total, 0);
    expect(sumaFamilias).toBe(100000);
  });
});
