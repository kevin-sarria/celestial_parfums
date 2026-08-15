import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO 7 — teclear cuánto pedir NO reinicia la pantalla.
 *
 * Lo reportó el dueño el 2026-08-14: *"al momento de cambiar el número de ml de
 * una esencia a pedir este hace como una recarga de página molesta"*.
 *
 * La causa era un clásico de React: la tabla se declaraba DENTRO del componente
 * de la pantalla, así que en cada tecla era una función nueva, React la tomaba
 * por otro componente distinto y **desmontaba y volvía a montar toda la tabla**.
 * El campo se destruía a media escritura: el foco se perdía y solo entraba el
 * primer dígito.
 *
 * Por eso la prueba escribe VARIOS dígitos: con uno solo el fallo no se ve.
 */

const MATERIAL = 'Pedido sugerido – Esencia';

const sesion = abrirDashboard();

beforeAll(async () => {
  // Un material bajo mínimo, que es lo que hace aparecer la lista.
  await prisma.insumoCosto.deleteMany({ where: { nombre: MATERIAL } });
  await prisma.insumoCosto.create({
    data: {
      nombre: MATERIAL, tipo: 'materia_prima', unidad: 'ml',
      precio: 500, stock: 0, stock_minimo: 100, activo: true,
    },
  });
});

afterAll(async () => {
  await (await sesion).contexto.close();
  await cerrarNavegador();
  await prisma.insumoCosto.deleteMany({ where: { nombre: MATERIAL } });
});

describe('pedido sugerido: ajustar la cantidad', () => {
  it('escribir la cantidad no reinicia la tabla ni pierde el foco', async () => {
    const { pagina } = await sesion;
    await pagina.setViewportSize({ width: 1366, height: 900 });
    await irA(pagina, '/dashboard/reposicion');
    await pagina.waitForSelector(`text=${MATERIAL}`, { timeout: 30_000 });

    const campo = pagina.getByLabel(`Cuánto pedir de ${MATERIAL}`);
    await campo.click();
    // Marca de identidad del nodo: si la tabla se remonta, el campo es OTRO.
    await pagina.evaluate(() => {
      (document.activeElement as HTMLElement).dataset.marca = 'antes-de-teclear';
    });

    // Se teclea DÍGITO A DÍGITO sobre lo que había (no `fill`, que escribe de
    // una sola vez): el fallo solo aparece con varias pulsaciones seguidas,
    // porque la tabla se remontaba entre una y otra.
    await pagina.keyboard.press('Control+a');
    await pagina.keyboard.type('999');

    // Los tres dígitos entraron: el campo no se destruyó a media escritura.
    expect(await campo.inputValue()).toBe('999');

    // Y sigue siendo EL MISMO nodo, con el foco puesto.
    const estado = await pagina.evaluate(() => {
      const activo = document.activeElement as HTMLElement;
      return { marca: activo?.dataset?.marca ?? null, etiqueta: activo?.getAttribute('aria-label') };
    });
    expect(estado.marca).toBe('antes-de-teclear');
    expect(estado.etiqueta).toContain('Cuánto pedir');
  });
});
