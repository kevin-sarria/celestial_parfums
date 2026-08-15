import { beforeEach, describe, expect, it } from 'vitest';
import { limpiarBase, crearVenta } from '../test/baseDePrueba';
import { getAllVentas } from './venta.repository';

/**
 * LA LISTA Y SUS TOTALES VIENEN JUNTOS SI SE PIDEN JUNTOS.
 *
 * La pantalla de Ventas necesita las dos cosas a la vez y las pedía en dos
 * viajes al servidor. Desde Colombia al VPS, cada viaje son 100-200 ms: pedir
 * dos veces lo que se pinta a la vez es medio segundo de nada. El servidor
 * resuelve las dos consultas **en paralelo** y las manda en la misma respuesta.
 *
 * Va bajo petición (`conTotales`) y no siempre: quien solo quiera la lista
 * —una exportación, otra pantalla— no tiene por qué pagar una agregación de
 * todo el mes.
 */

describe('getAllVentas', () => {
  beforeEach(limpiarBase);

  it('sin pedirlos, no trae totales', async () => {
    await crearVenta({ valor: 60000 });

    const res = await getAllVentas(1, 10);

    expect(res.data).toHaveLength(1);
    expect(res).not.toHaveProperty('totales');
  });

  it('pidiéndolos, vienen en la MISMA respuesta', async () => {
    await crearVenta({ valor: 60000 });
    await crearVenta({ valor: 40000 });

    const res = await getAllVentas(1, 10, undefined, true);

    expect(res.data).toHaveLength(2);
    expect(res.total).toBe(2);
    // Los totales son del MES, no de la página: no dependen del paginado.
    expect(res.totales).toBeDefined();
    expect(res.totales!.ingresos_mes).toBe(100000);
  });

  it('los totales no se recortan con la página', async () => {
    await crearVenta({ valor: 60000 });
    await crearVenta({ valor: 40000 });

    const res = await getAllVentas(1, 1, undefined, true);

    expect(res.data).toHaveLength(1);           // la página sí
    expect(res.totales!.ingresos_mes).toBe(100000); // los totales no
  });
});
