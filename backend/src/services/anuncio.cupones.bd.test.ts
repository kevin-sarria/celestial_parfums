import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearCampanaCupon, crearCliente, crearVenta, limpiarBase } from '../test/baseDePrueba';
import {
  aplicarCodigoAVenta,
  canjearCodigoEnCredito,
  codigoCanjeadoDeVenta,
  emitirCodigo,
  liberarCodigoDeVenta,
  validarCodigoParaVenta,
} from './anuncio.service';

/**
 * Los cupones: un solo uso en la vida, uno por persona a la vez, y —desde el
 * 2026-08-02— **amarrados a su venta** una vez canjeados.
 *
 * Esa última regla vive en el SERVIDOR a propósito: la pantalla se puede
 * saltar, y antes bastaba con borrar el texto del campo al editar una venta
 * —incluso sin querer— para revivir un cupón ya gastado y regalarlo dos veces.
 *
 * Reglas en CLAUDE.md → "Cupones" y "CUPÓN CANJEADO = AMARRADO A SU VENTA".
 */

const estadoDelCodigo = (codigo: string) =>
  prisma.descuentoCodigo.findUniqueOrThrow({ where: { codigo } });

describe('emitir un cupón', () => {
  beforeEach(limpiarBase);

  it('una persona sostiene UN solo cupón a la vez, sea de la campaña que sea', async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promoA = await crearCampanaCupon();
    const promoB = await crearCampanaCupon();

    await emitirCodigo(cliente.id, promoA.id);

    await expect(emitirCodigo(cliente.id, promoB.id)).rejects.toThrow(/Ya tienes un cupón activo/);
  });

  it('pedir dos veces el mismo cupón devuelve el que ya tenía, no uno nuevo', async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();

    const primero = await emitirCodigo(cliente.id, promo.id);
    const segundo = await emitirCodigo(cliente.id, promo.id);

    expect(segundo.codigo).toBe(primero.codigo);
    expect(await prisma.descuentoCodigo.count()).toBe(1);
  });

  it('un cupón ya usado no se vuelve a emitir: es de un solo uso en la vida', async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();
    const venta = await crearVenta();
    const codigo = await emitirCodigo(cliente.id, promo.id);
    await aplicarCodigoAVenta(codigo.codigo, venta.id, true);

    await expect(emitirCodigo(cliente.id, promo.id)).rejects.toThrow(/Ya usaste este cupón/);
  });

  it('agotado el cupo de la campaña deja de emitir', async () => {
    const promo = await crearCampanaCupon({ max_canjes: 1 });
    const ana = await crearCliente('ana@prueba.local');
    const beto = await crearCliente('beto@prueba.local');

    await emitirCodigo(ana.id, promo.id);

    await expect(emitirCodigo(beto.id, promo.id)).rejects.toThrow(/agotó su cupo/);
  });
});

describe('el cupón canjeado queda amarrado a su venta', () => {
  let venta = 0;
  let otraVenta = 0;

  beforeEach(async () => {
    await limpiarBase();
    venta = (await crearVenta()).id;
    otraVenta = (await crearVenta()).id;
  });

  /** Deja un cupón CANJEADO en `venta`, que es el estado que dispara la regla. */
  const cuponCanjeado = async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();
    const codigo = await emitirCodigo(cliente.id, promo.id);
    await aplicarCodigoAVenta(codigo.codigo, venta, true);
    return codigo.codigo;
  };

  it('al canjearse queda enlazado a la venta y con fecha de canje', async () => {
    const codigo = await cuponCanjeado();

    const row = await estadoDelCodigo(codigo);
    expect(row.estado).toBe('canjeado');
    expect(row.venta_id).toBe(venta);
    expect(row.canjeado_at).not.toBeNull();
  });

  it('EDITAR la venta sin el código NO lo libera', async () => {
    const codigo = await cuponCanjeado();

    // Así llama el editor de ventas: `soloNoCanjeados = true`.
    await liberarCodigoDeVenta(venta, null, true);

    const row = await estadoDelCodigo(codigo);
    expect(row.estado).toBe('canjeado');
    expect(row.venta_id).toBe(venta);
  });

  it('BORRAR la venta sí lo libera: ahí la compra se deshizo de verdad', async () => {
    const codigo = await cuponCanjeado();

    // Así llama el borrado: sin `soloNoCanjeados`.
    await liberarCodigoDeVenta(venta);

    const row = await estadoDelCodigo(codigo);
    expect(row.estado).toBe('activo');
    expect(row.venta_id).toBeNull();
    expect(row.canjeado_at).toBeNull();
  });

  it('el servidor sabe qué código canjeado tiene una venta, para impedir cambiarlo', async () => {
    const codigo = await cuponCanjeado();

    expect(await codigoCanjeadoDeVenta(venta)).toBe(codigo);
    expect(await codigoCanjeadoDeVenta(otraVenta)).toBeNull();
  });

  it('un código ya canjeado no se puede enlazar a OTRA venta', async () => {
    const codigo = await cuponCanjeado();

    await expect(validarCodigoParaVenta(codigo, otraVenta)).rejects.toThrow(/ya está usado en otra venta/);
  });

  it('un código reservado en una venta pendiente tampoco se le pasa a otra', async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();
    const codigo = await emitirCodigo(cliente.id, promo.id);
    // Venta sin pagar: el código queda reservado, todavía activo.
    await aplicarCodigoAVenta(codigo.codigo, venta, false);

    expect((await estadoDelCodigo(codigo.codigo)).estado).toBe('activo');
    await expect(validarCodigoParaVenta(codigo.codigo, otraVenta)).rejects.toThrow(/ya está usado en otra venta/);
  });

  it('editar la MISMA venta con el MISMO código sigue siendo válido', async () => {
    const codigo = await cuponCanjeado();

    await expect(validarCodigoParaVenta(codigo, venta)).resolves.toMatchObject({ codigo });
  });

  it('un código que no existe se rechaza con su motivo', async () => {
    await expect(validarCodigoParaVenta('CP-NOEXISTE', venta)).rejects.toThrow(/no existe/);
  });
});

describe('cupón sobre un crédito: se consume al instante', () => {
  let venta = 0;

  beforeEach(async () => {
    await limpiarBase();
    venta = (await crearVenta({ pagada: false })).id;
  });

  it('a diferencia de una venta, no espera a que la deuda se pague', async () => {
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();
    const codigo = await emitirCodigo(cliente.id, promo.id);

    await canjearCodigoEnCredito(codigo.codigo, venta);

    // El cliente ya recibió el descuento en la deuda: el cupón muere ahí.
    const row = await estadoDelCodigo(codigo.codigo);
    expect(row.estado).toBe('canjeado');
    expect(row.canjeado_at).not.toBeNull();
  });

  it('en CRÉDITOS quitar el código sí lo libera, y es a propósito', async () => {
    // Es el único camino para devolver un cupón canjeado en un crédito. Ojo:
    // en VENTAS la regla es la contraria. Igualarlas es una decisión aparte que
    // hay que hablar con el dueño, no un descuido.
    const cliente = await crearCliente('ana@prueba.local');
    const promo = await crearCampanaCupon();
    const codigo = await emitirCodigo(cliente.id, promo.id);
    await canjearCodigoEnCredito(codigo.codigo, venta);

    await liberarCodigoDeVenta(venta);

    expect((await estadoDelCodigo(codigo.codigo)).estado).toBe('activo');
  });
});
