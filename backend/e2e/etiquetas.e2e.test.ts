import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — las etiquetas de los formularios apuntan a su campo.
 *
 * `Field` pintaba un `<label>` suelto, sin `htmlFor`: ni el navegador ni un
 * lector de pantalla lo asociaban al control. Hacer clic en "Nombre" no llevaba
 * el cursor a su casilla, y quien navega a ciegas oía "cuadro de edición" sin
 * saber de qué.
 *
 * Se prueba en el modal de perfume porque es el formulario más grande del
 * dashboard, y el arreglo vive en piezas compartidas (`Field`, `Input`,
 * `Textarea`, `BuscadorSelect`): si se rompe, se rompe en los 25 modales a la
 * vez.
 *
 * Las tres cosas que se miden, y por qué cada una:
 * 1. **Cuántas etiquetas tienen control** — el número que subió con el arreglo.
 * 2. **Ninguna apunta al vacío** — un `htmlFor` roto promete una relación que no
 *    existe; es peor que no tener ninguna.
 * 3. **Ningún `id` repetido** — dos controles con el mismo id dejan a la
 *    etiqueta hablando del que no es, y es el fallo natural de este mecanismo
 *    cuando un campo lleva dos controles (fecha desde/hasta, color y su hex).
 */

afterAll(cerrarNavegador);

describe('las etiquetas de los formularios del dashboard', () => {
  it('apuntan al campo que nombran, sin referencias rotas ni ids repetidos', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.waitForSelector('text=+ Nuevo perfume');
    await pagina.getByRole('button', { name: '+ Nuevo perfume' }).click();
    await pagina.getByRole('dialog').waitFor();

    const medida = await pagina.evaluate(() => {
      const dialogo = document.querySelector('[role="dialog"]')!;
      const etiquetas = [...dialogo.querySelectorAll('label')];
      const conFor = etiquetas.filter((l) => l.htmlFor);
      const ids = [...dialogo.querySelectorAll('[id]')].map((e) => e.id);
      return {
        etiquetas: etiquetas.length,
        conControl: etiquetas.filter((l) => l.control).length,
        rotas: conFor.filter((l) => !document.getElementById(l.htmlFor)).length,
        idsRepetidos: ids.length - new Set(ids).size,
      };
    });

    // El formulario de perfume es grande: si un día se queda sin campos, la
    // prueba pasaría vacía sin comprobar nada.
    expect(medida.etiquetas).toBeGreaterThan(8);
    // Medido el 2026-08-22 en este mismo modal: **3 de 16 antes del arreglo**
    // (solo las casillas, que envuelven su propio input) y **13 de 16 después**.
    // Las 3 que quedan fuera son grupos —los aromas, las ocasiones, la tabla de
    // presentaciones—, donde la etiqueta nombra un conjunto y no hay un control
    // al que apuntar. Por eso el margen de 3 y no cero.
    expect(medida.conControl).toBeGreaterThanOrEqual(medida.etiquetas - 3);
    expect(medida.rotas).toBe(0);
    expect(medida.idsRepetidos).toBe(0);

    // Y lo que se nota usándolo: clic en el texto de la etiqueta = cursor en su
    // casilla. Es la mitad del arreglo que no se ve en el HTML.
    const nombre = pagina.getByRole('dialog').locator('label', { hasText: /^Nombre \*$/ }).first();
    await nombre.click();
    const enfocado = await pagina.evaluate(() => {
      const activo = document.activeElement as HTMLElement | null;
      return { etiqueta: activo?.tagName, nombre: (activo as HTMLInputElement)?.name ?? '' };
    });
    expect(enfocado.etiqueta).toBe('INPUT');

    await contexto.close();
  });
});
