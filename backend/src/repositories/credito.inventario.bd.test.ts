import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import {
  crearCliente, crearInsumo, estadoDe, limpiarBase, sembrarFabricacion30ml,
} from '../test/baseDePrueba';
import { createCredito, updateCredito } from './credito.repository';
import { aplicarMovimientoTerminado } from './inventario.terminado';

/**
 * VENDER A CRÉDITO ES VENDER.
 *
 * Hasta el 2026-08-24 no lo era: el crédito armaba su venta a mano en vez de
 * pasar por `createVenta`, y en esa copia se había quedado fuera el consumo de
 * inventario. Medido contra el respaldo de producción de ese día: de los 5
 * créditos con venta enlazada, **4 no movieron ni un gramo** — el único que sí
 * fue porque el dueño editó esa venta después desde el módulo de Ventas.
 *
 * Lo que costaba: el material salía físicamente y el sistema seguía contándolo
 * en bodega, así que la ganancia del mes salía inflada cada vez que se vendía
 * fiado. Y como la línea del crédito no guardaba ni la talla, no había forma de
 * meter un 1.1 ni un perfumero: por eso el crédito del 24 de julio dice
 * "Thank U Next 1.1, Emeer 1.1, Gorra Equin…" escrito a mano.
 */

const FECHA = '2026-08-24';

const creditoBase = async () => ({
  fecha: FECHA,
  user_id: (await crearCliente('fiado@ejemplo.com')).id,
  articulos: 'Lo que se llevó',
  deuda_inicial: 100000,
});

describe('un crédito descuenta inventario igual que una venta', () => {
  beforeEach(limpiarBase);

  it('descuenta la receta de la talla que dice la línea', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const base = await creditoBase();

    await createCredito({
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 2, regalo: 0 }],
    });

    // La receta de 30 ml × 2: 15 esencia, 14,30 diluyente, 0,40 sellador,
    // 0,30 feromonas y un frasco por unidad.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000 - 30);
    expect((await estadoDe(s.diluyente.id)).stock).toBe(1000 - 28.6);
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 2);
  });

  it('congela el costo en la venta enlazada, para que la ganancia del mes sea real', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const base = await creditoBase();

    const credito = await createCredito({
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 }],
    });

    const venta = await prisma.venta.findUniqueOrThrow({ where: { id: credito.venta!.id } });
    // 15×1500 + 14,3×20 + 0,4×100 + 0,3×100 + 2.850 = 25.706
    expect(Number(venta.costo_mercancia)).toBe(25706);
  });

  it('un 1.1 sale del frasco ya armado y no vuelve a gastar la receta', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    // El frasco armado, como lo deja una producción: una unidad con su costo.
    await prisma.$transaction((tx) => aplicarMovimientoTerminado(tx, {
      perfume_id: s.perfume.id,
      presentacion_id: s.presentacion.id,
      tipo: 'produccion',
      cantidad: 1,
      costo_unitario: 74580,
      fecha: new Date(FECHA),
    }));
    const base = await creditoBase();

    await createCredito({
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 }],
    });

    const fila = await prisma.perfumePresentacion.findUniqueOrThrow({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
        },
      },
    });
    expect(Number(fila.stock)).toBe(0);
    // La esencia NO se toca: el frasco ya estaba armado.
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
  });

  it('un accesorio comprado descuenta su unidad, sin pedirle talla', async () => {
    const perfumero = await crearInsumo('Perfumero Recargable', {
      tipo: 'accesorio', precio: 2100, stock: 40,
    });
    const producto = await prisma.perfume.create({
      data: {
        nombre: 'Perfumero Recargable',
        precio: 5000,
        tipo_producto: 'comprado',
        es_accesorio: true,
        insumo_producto_id: perfumero.id,
      },
    });
    const base = await creditoBase();

    await createCredito({
      ...base,
      lineas: [{ perfume_id: producto.id, ml: null, cantidad: 3, regalo: 0 }],
    });

    expect((await estadoDe(perfumero.id)).stock).toBe(40 - 3);
  });

  it('editar el crédito devuelve lo anterior y descuenta lo nuevo', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const base = await creditoBase();

    const credito = await createCredito({
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 3, regalo: 0 }],
    });
    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 3);

    await updateCredito(String(credito.id), {
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 }],
    });

    expect((await estadoDe(s.frasco.id)).stock).toBe(1000 - 1);
  });

  it('un crédito importado por Excel (solo texto) sigue funcionando y no descuenta', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const base = await creditoBase();

    // El importador no manda líneas: deduce los perfumes del texto libre, y esas
    // líneas no tienen talla. Sin talla no se sabe qué receta aplicar, así que
    // no descuentan — mismo criterio que las 261 ventas históricas.
    const credito = await createCredito({ ...base, articulos: 'Eternity' });

    expect(credito.venta).not.toBeNull();
    expect((await estadoDe(s.esencia.id)).stock).toBe(1000);
  });

  it('al releerlo, cada producto trae la talla con la que se guardó', async () => {
    const s = await sembrarFabricacion30ml({ stock: 1000 });
    const base = await creditoBase();

    const credito = await createCredito({
      ...base,
      lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 2, regalo: 1 }],
    });

    // Sin esto, el editor tiene que adivinar la talla del texto del resumen: dos
    // tallas distintas en el mismo crédito se aplastaban en una, y al guardar se
    // descontaba del inventario una talla que el cliente nunca se llevó.
    expect(credito.productos).toEqual([
      { perfume_id: s.perfume.id, cantidad: 2, ml: 30, regalo: 1 },
    ]);
  });
});
