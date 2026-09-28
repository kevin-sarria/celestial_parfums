import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../config/prisma';
import { crearCliente, limpiarBase } from '../test/baseDePrueba';
import { addAbono, createCredito, deleteAbono } from './credito.repository';

/**
 * UN ABONO NO SE PUEDE GUARDAR DOS VECES POR ACCIDENTE.
 *
 * Pasó en producción el 2026-09-05: un abono de $50.000 quedó dos veces y la
 * cliente apareció pagando $290.000 de una deuda de $240.000. El formulario no
 * se bloqueaba al guardar y el Enter mandaba un abono por pulsación. El
 * formulario ya se arregló, pero el servidor es el único que ve TODAS las
 * puertas (doble clic, red lenta que reintenta, dos pestañas), así que también
 * se defiende él.
 */

const nuevoCredito = async (deuda = 240000) => {
  const cliente = await crearCliente(`abono-${Date.now()}-${Math.random()}@prueba.com`);
  return createCredito({
    fecha: '2026-09-01', user_id: cliente.id, articulos: 'Un perfume', deuda_inicial: deuda,
  });
};

describe('abonos repetidos', () => {
  beforeEach(limpiarBase);

  it('dos abonos idénticos seguidos: entra uno y el otro se rechaza', async () => {
    const c = await nuevoCredito();
    await addAbono(String(c.id), 50000);
    await expect(addAbono(String(c.id), 50000)).rejects.toThrow(/ya quedó registrado/);
    expect(await prisma.creditoAbono.count({ where: { credito_id: c.id } })).toBe(1);
  });

  it('dos abonos idénticos AL MISMO TIEMPO (doble clic): entra uno solo', async () => {
    const c = await nuevoCredito();
    const intentos = await Promise.allSettled([
      addAbono(String(c.id), 50000),
      addAbono(String(c.id), 50000),
      addAbono(String(c.id), 50000),
    ]);
    expect(intentos.filter((i) => i.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.creditoAbono.count({ where: { credito_id: c.id } })).toBe(1);
  });

  it('otro monto sí entra: no es un repetido', async () => {
    const c = await nuevoCredito();
    await addAbono(String(c.id), 50000);
    const credito = await addAbono(String(c.id), 30000);
    expect(credito.total_abonado).toBe(80000);
  });

  it('el mismo monto en OTRO crédito sí entra', async () => {
    const a = await nuevoCredito();
    const b = await nuevoCredito();
    await addAbono(String(a.id), 50000);
    await expect(addAbono(String(b.id), 50000)).resolves.toBeTruthy();
  });

  it('pasada la ventana, el mismo monto vuelve a entrar', async () => {
    const c = await nuevoCredito();
    await addAbono(String(c.id), 50000);
    // Se envejece el primero en vez de esperar un minuto de verdad
    await prisma.creditoAbono.updateMany({
      where: { credito_id: c.id }, data: { created_at: new Date(Date.now() - 5 * 60_000) },
    });
    await expect(addAbono(String(c.id), 50000)).resolves.toBeTruthy();
  });
});

describe('borrar un abono', () => {
  beforeEach(limpiarBase);

  it('devuelve el crédito ya sin ese abono y la deuda reabierta', async () => {
    const c = await nuevoCredito(100000);
    const saldado = await addAbono(String(c.id), 100000);
    expect(saldado.total_en_deuda).toBe(0);

    const credito = await deleteAbono(String(c.id), String(saldado.abonos[0].id));
    expect(credito.abonos).toHaveLength(0);
    expect(credito.total_en_deuda).toBe(100000);
    // Saldado, su venta estaba pagada; con la deuda abierta vuelve a pendiente
    const fila = await prisma.credito.findUniqueOrThrow({
      where: { id: c.id }, select: { venta: { select: { pagada: true } } },
    });
    expect(fila.venta?.pagada).toBe(false);
  });

  it('no borra un abono de OTRO crédito aunque se le pase su número', async () => {
    const a = await nuevoCredito();
    const b = await nuevoCredito();
    const conAbono = await addAbono(String(a.id), 50000);
    await expect(deleteAbono(String(b.id), String(conAbono.abonos[0].id))).rejects.toThrow(/ya no existe/);
    expect(await prisma.creditoAbono.count({ where: { credito_id: a.id } })).toBe(1);
  });
});

/**
 * El historial de pagos muestra el día y la hora de cada abono. El día tiene
 * que ser el de COLOMBIA: hasta el 2026-09-28 se guardaba el día UTC y un abono
 * de las 8:27 p.m. del 21 de septiembre quedó anotado el 22.
 */
describe('día y hora del abono', () => {
  beforeEach(limpiarBase);
  afterEach(() => { vi.useRealTimers(); });

  it('un abono de las 8:27 p.m. queda en ese día, no en el siguiente', async () => {
    const c = await nuevoCredito();
    // Solo se congela el reloj de Date: Prisma sigue usando sus temporizadores
    vi.useFakeTimers({ toFake: ['Date'] });
    const instante = new Date('2026-09-22T01:27:00.000Z'); // 21-sep 8:27 p.m. en Colombia
    vi.setSystemTime(instante);

    const credito = await addAbono(String(c.id), 40000);

    expect(credito.abonos[0].fecha.toISOString().slice(0, 10)).toBe('2026-09-21');
    expect(credito.abonos[0].registrado_en.getTime()).toBe(instante.getTime());
  });
});
