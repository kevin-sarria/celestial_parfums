import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';
import { abrirDashboard, campo, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — los envases sin existencias no se disfrazan de disponibles.
 *
 * Lo encontró el dueño el 2026-08-23 registrando una producción: sus 5 envases
 * 1.1 estaban en cero —cada lote se llevó el suyo, que es correcto— y seguían
 * mezclados con los demás en el desplegable, como si hubiera. El mismo descuido
 * ya le había dejado el Perfumero Recargable en −25 unidades.
 *
 * **No se esconden**, a propósito: registrar hoy un lote de la semana pasada,
 * cuando sí había envase, es un caso legítimo. Lo que cambia es que se vean por
 * lo que son, y que caigan al final.
 */

const foto = (nombre: string) => path.join(os.tmpdir(), `celestial-${nombre}.png`);

/** Nombre propio: los recorridos comparten base y ninguno puede pisar a otro. */
const AGOTADO = `Envase agotado recorrido ${Date.now()}`;

afterAll(async () => {
  await prisma.insumoCosto.deleteMany({ where: { nombre: AGOTADO } });
  await cerrarNavegador();
});

describe('envases sin existencias al registrar una producción', () => {
  it('van al final, dicen "sin existencias", y los que hay enseñan cuántos quedan', async () => {
    await crearInsumo(AGOTADO, { tipo: 'envase', precio: 5000, stock: 0 });

    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/inventario');
    await pagina.waitForSelector('text=Registrar llegada');
    await pagina.getByRole('button', { name: /^Registrar uso$/ }).click();
    await pagina.getByRole('menuitem', { name: /Armé perfumes/ }).click();
    await pagina.waitForSelector('text=Registrar producción');

    await campo(pagina, 'Envase usado').click();
    const textos = await pagina.locator('[role="option"]').allInnerTexts();
    await pagina.screenshot({ path: foto('envases-sin-existencias') });

    // 1. El que está en cero lo dice, con esas palabras.
    const agotado = textos.find((t) => t.includes(AGOTADO));
    expect(agotado).toContain('sin existencias');

    // 2. El que sí hay enseña cuántos quedan, para no ir a mirarlo a otra pantalla.
    expect(textos.find((t) => t.includes('Frasco 30 ml'))).toContain('quedan ');

    // 3. Y el orden: en cuanto empiezan los agotados, ya no vuelve a haber uno
    // con existencias. Se comprueba así —y no por posición fija— porque otros
    // recorridos siembran sus propios envases en la misma base.
    const primerAgotado = textos.findIndex((t) => t.includes('sin existencias'));
    expect(primerAgotado).toBeGreaterThan(0);
    expect(textos.slice(primerAgotado).some((t) => t.includes('quedan '))).toBe(false);

    await contexto.close();
  }, 90_000);
});
