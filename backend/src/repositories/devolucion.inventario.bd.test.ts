import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { estadoDe, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { actualizarDevolucion, cambiarEstadoDevolucion, crearDevolucion, eliminarDevolucion } from './devolucion.repository';
import { createVenta } from './venta.repository';

/**
 * QUÉ LE PASA AL INVENTARIO CUANDO SE RESUELVE UNA DEVOLUCIÓN.
 *
 * Hasta el 2026-08-30 no le pasaba nada: reponer un frasco lo sacaba de la casa
 * del dueño y no de su sistema. Decisión suya ese día: **se pregunta caso por
 * caso** si el producto volvió y si sirve, porque el motivo del reclamo no
 * alcanza para adivinarlo.
 *
 * Lo que estas pruebas fijan es la tabla entera de combinaciones, que es donde
 * un descuido cuesta plata sin que nadie lo note.
 */

const FECHA = '2026-08-20';

/** Un escenario con una venta hecha y frascos armados listos para reponer. */
const conVentaYArmados = async (armados = 5) => {
  const s = await sembrarFabricacion30ml({ stock: 1000 });
  await prisma.perfumePresentacion.create({
    data: {
      perfume_id: s.perfume.id, presentacion_id: s.presentacion.id,
      stock: armados, costo_promedio: 20000,
    },
  });
  const venta = await createVenta({
    dia: FECHA, persona: 'Cliente de prueba', cantidad_perfumes: 1,
    valor_venta: 60000, pagada: true,
    lineas: [{ perfume_id: s.perfume.id, ml: 30, cantidad: 1, regalo: 0 }],
  } as never);
  return { s, venta };
};

const armadosDe = async (perfumeId: number, presentacionId: number) => {
  const f = await prisma.perfumePresentacion.findUnique({
    where: { perfume_id_presentacion_id: { perfume_id: perfumeId, presentacion_id: presentacionId } },
  });
  return Number(f?.stock ?? 0);
};

/** Una devolución del caso, lista para resolverse como se quiera. */
const abrirCaso = async (
  ventaId: number, perfumeId: number,
  extra: Record<string, unknown> = {},
) => crearDevolucion({
  venta_id: ventaId,
  fecha: FECHA,
  motivo: 'llego_danado',
  estado: 'en_revision',
  monto_devuelto: 0,
  reposicion_cantidad: 0,
  costo_reposicion: 0,
  costo_envio: 0,
  perfumes: [{ perfume_id: perfumeId, cantidad: 1 }],
  ...extra,
} as never);

describe('resolver una devolución mueve el inventario', () => {
  beforeEach(limpiarBase);

  it('reponer un frasco lo SACA de los armados', async () => {
    const { s, venta } = await conVentaYArmados();
    // La venta ya se llevó uno: quedan 4.
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);

    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });
    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(3);
  });

  it('devuelto y REVENDIBLE vuelve al inventario', async () => {
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'devolucion_dinero', monto_devuelto: 60000,
      producto_devuelto: true, revendible: true,
    });

    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    // Vuelve el que se había llevado: de 4 a 5.
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(5);
  });

  it('devuelto y NO revendible no vuelve: su costo ya se cargó en la venta', async () => {
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'devolucion_dinero', monto_devuelto: 60000,
      producto_devuelto: true, revendible: false,
    });

    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);
  });

  it('sin producto devuelto y sin reposición no toca nada', async () => {
    // El caso "no llegó" o el que se aclara por teléfono.
    const { s, venta } = await conVentaYArmados();
    const antes = (await estadoDe(s.esencia.id)).stock;
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'ninguna', motivo: 'no_llego',
    });

    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);
    expect((await estadoDe(s.esencia.id)).stock).toBe(antes);
  });

  it('reponer y recuperar a la vez se compensan', async () => {
    // Le mandas otro y te devuelve el malo, pero sirve: sale uno y entra otro.
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
      producto_devuelto: true, revendible: true,
    });

    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);
  });

  it('sin frascos armados, reponer FABRICA uno: descuenta la receta', async () => {
    const { s, venta } = await conVentaYArmados(1);
    // La venta se llevó el único armado.
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(0);
    const esenciaAntes = (await estadoDe(s.esencia.id)).stock;

    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });
    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    // Es un contratipo: se arma contra pedido, también cuando es una garantía.
    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaAntes - 15);
  });

  it('un 1.1 repuesto NO se fabrica: queda en negativo y avisa', async () => {
    const { s, venta } = await conVentaYArmados(1);
    await prisma.perfume.update({ where: { id: s.perfume.id }, data: { solo_armado: true } });
    const esenciaAntes = (await estadoDe(s.esencia.id)).stock;

    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });
    const resuelta = await cambiarEstadoDevolucion(caso.id, 'resuelta');

    expect((await estadoDe(s.esencia.id)).stock).toBe(esenciaAntes);
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(-1);
    expect(resuelta.avisos.join(' ')).toMatch(/sin tenerlo armado/);
  });

  it('un caso que NACE resuelto también mueve el inventario', async () => {
    // El típico "se lo repuse ayer y lo estoy anotando hoy": se registra ya
    // cerrado y nunca pasa por el cambio de estado.
    const { s, venta } = await conVentaYArmados();

    await abrirCaso(venta.id, s.perfume.id, {
      estado: 'resuelta', solucion: 'reposicion',
      reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(3);
  });

  it('reabrir el caso deshace lo que había movido', async () => {
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 2, reposicion_formula_id: s.formula.id,
    });
    await cambiarEstadoDevolucion(caso.id, 'resuelta');
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(2);

    await cambiarEstadoDevolucion(caso.id, 'en_revision');

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);
  });

  it('corregir una devolución ya resuelta no cuenta dos veces', async () => {
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });
    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    // Se corrige: en realidad fueron dos frascos, no uno.
    await actualizarDevolucion(caso.id, {
      venta_id: venta.id, fecha: FECHA, motivo: 'llego_danado', estado: 'resuelta',
      solucion: 'reposicion', monto_devuelto: 0,
      reposicion_cantidad: 2, reposicion_formula_id: s.formula.id,
      costo_reposicion: 0, costo_envio: 0,
      perfumes: [{ perfume_id: s.perfume.id, cantidad: 1 }],
    } as never);

    // 4 − 2, no 4 − 1 − 2.
    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(2);
  });

  it('borrar el caso devuelve el frasco repuesto', async () => {
    const { s, venta } = await conVentaYArmados();
    const caso = await abrirCaso(venta.id, s.perfume.id, {
      solucion: 'reposicion', reposicion_cantidad: 1, reposicion_formula_id: s.formula.id,
    });
    await cambiarEstadoDevolucion(caso.id, 'resuelta');

    await eliminarDevolucion(caso.id);

    expect(await armadosDe(s.perfume.id, s.presentacion.id)).toBe(4);
  });
});
