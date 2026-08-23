import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { crearInsumo } from './costeo.repository';

/**
 * UN ACCESORIO DEL INVENTARIO TIENE QUE PODERSE VENDER.
 *
 * El dueño lo dijo con todas las letras el 2026-08-22: *"si lo tengo en mi
 * inventario debería aparecer como tal"*. Tenía razón — y el sistema ya le hacía
 * ese favor a las esencias (al comprarlas estrena su fragancia) pero no a los
 * accesorios. Resultado: el perfumero recargable existía como material, no como
 * producto, así que **no se podía meter en ninguna venta** y los que regalaba no
 * descontaban de nada. Su stock llevaba tiempo en negativo por eso.
 *
 * Lo que estas pruebas fijan es el contrato de ese favor: qué se crea, con qué
 * enlace, y —lo que más importa— que el COSTO y el PRECIO no se confundan.
 */

const insumoAccesorio = (nombre: string, extra: Record<string, unknown> = {}) => ({
  nombre,
  tipo: 'accesorio' as const,
  unidad: 'unidad' as const,
  alcance: 'unidad' as const,
  precio: 0,
  ...extra,
});

describe('accesorio vendible desde el inventario', () => {
  beforeEach(async () => { await limpiarBase(); });

  it('crea el producto enlazado al material, listo para vender', async () => {
    const res = await crearInsumo(insumoAccesorio('Perfumero Recargable', {
      crear_perfume: true, perfume_nombre: 'Perfumero Recargable', precio_venta: 5000,
    }));

    expect(res.perfume?.accion).toBe('creado');

    const producto = await prisma.perfume.findUnique({ where: { id: res.perfume!.id } });
    expect(producto).not.toBeNull();
    // Es accesorio: va en su propio buscador, aparte de las fragancias.
    expect(producto!.es_accesorio).toBe(true);
    // Se compra hecho y se revende: no tiene receta ni talla.
    expect(producto!.tipo_producto).toBe('comprado');
    // Y sale del inventario por SU material, que es lo que arregla el negativo.
    expect(producto!.insumo_producto_id).toBe(res.id);
  });

  it('el PRECIO de venta no es el COSTO del material', async () => {
    /**
     * El corazón del asunto. `precio` en el material es lo que te cuesta ($2.100
     * el perfumero) y `precio` en el producto es lo que cobras ($5.000). Si se
     * copiara el costo, el dueño estaría vendiendo a precio de costo sin
     * enterarse — y creyendo que gana.
     */
    const res = await crearInsumo(insumoAccesorio('Bolsa Organza', {
      precio: 300, crear_perfume: true, perfume_nombre: 'Bolsa Organza', precio_venta: 3000,
    }));

    const material = await prisma.insumoCosto.findUnique({ where: { id: res.id } });
    const producto = await prisma.perfume.findUnique({ where: { id: res.perfume!.id } });

    expect(Number(material!.precio)).toBe(300);
    expect(Number(producto!.precio)).toBe(3000);
  });

  it('nace fuera de la tienda: publicarlo lo decide el dueño en cada uno', async () => {
    const res = await crearInsumo(insumoAccesorio('Tarjeta de regalo', {
      crear_perfume: true, perfume_nombre: 'Tarjeta de regalo', precio_venta: 1000,
    }));

    const producto = await prisma.perfume.findUnique({ where: { id: res.perfume!.id } });
    expect(producto!.publicado).toBe(false);
  });

  it('sin marcar la casilla no crea nada: sigue siendo solo material', async () => {
    const res = await crearInsumo(insumoAccesorio('Caja de regalo'));

    expect(res.perfume).toBeNull();
    expect(await prisma.perfume.count({ where: { es_accesorio: true } })).toBe(0);
  });

  it('no pisa un producto que ya existía con ese nombre', async () => {
    /**
     * Convertir una ficha existente en "accesorio comprado" solo porque coincide
     * el nombre es como se corrompen los datos en silencio: un perfume normal
     * perdería su receta. Se avisa y decide el dueño.
     */
    const original = await prisma.perfume.create({
      data: { nombre: 'Perfumero Recargable', precio: 9999, tipo_producto: 'fabricado' },
    });

    const res = await crearInsumo(insumoAccesorio('Perfumero Recargable', {
      crear_perfume: true, perfume_nombre: 'Perfumero Recargable', precio_venta: 5000,
    }));

    expect(res.perfume?.accion).toBe('ya_existe');
    expect(res.perfume?.id).toBe(original.id);

    const sinTocar = await prisma.perfume.findUnique({ where: { id: original.id } });
    expect(sinTocar!.tipo_producto).toBe('fabricado');
    expect(sinTocar!.es_accesorio).toBe(false);
    expect(Number(sinTocar!.precio)).toBe(9999);
  });

  it('una esencia sigue estrenando su fragancia, no un accesorio', async () => {
    // El camino viejo no se toca: es el que ya usaba el dueño con las esencias.
    const gama = await prisma.gamaEsencia.create({ data: { nombre: 'Árabe' } });
    const res = await crearInsumo({
      nombre: 'Sauvage – Esencia',
      tipo: 'materia_prima' as const,
      unidad: 'ml' as const,
      alcance: 'unidad' as const,
      precio: 0,
      gama_id: gama.id,
      crear_perfume: true,
      perfume_nombre: 'Sauvage',
    });

    const producto = await prisma.perfume.findUnique({ where: { id: res.perfume!.id } });
    expect(producto!.es_accesorio).toBe(false);
    expect(producto!.tipo_producto).toBe('fabricado');
    expect(producto!.insumo_esencia_id).toBe(res.id);
  });
});
