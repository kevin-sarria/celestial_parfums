import { describe, expect, it, beforeEach } from 'vitest';
import { crearCliente, crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { prisma } from '../config/prisma';
import { createCreditoSchema } from '../schemas/credito.schema';
import * as servicio from '../services/credito.service';

describe('reproduccion del fallo del formulario', () => {
  beforeEach(limpiarBase);
  it('el body exacto del formulario', async () => {
    const insumo = await crearInsumo('Perfumero de prueba', { tipo: 'accesorio', precio: 5000, stock: 20 });
    const producto = await prisma.perfume.create({
      data: { nombre: 'Perfumero Recargable', precio: 5000, tipo_producto: 'comprado', es_accesorio: true, insumo_producto_id: insumo.id },
    });
    const cliente = await crearCliente('x@y.com');

    const body = {
      fecha: '2026-08-24',
      user_id: cliente.id,
      articulos: '2× Perfumero Recargable',
      lineas: [{ perfume_id: producto.id, ml: null, cantidad: 2, regalo: 0 }],
      presentacion: null,
      deuda_inicial: 10000,
      fecha_limite: '2026-09-23',
      codigo_descuento: null,
    };
    const parseado = createCreditoSchema.safeParse(body);
    console.log('ZOD OK?', parseado.success, JSON.stringify(parseado.error?.issues ?? []).slice(0, 300));
    expect(parseado.success).toBe(true);
    await servicio.createCredito(parseado.data!);
  });
});
