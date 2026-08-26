import { afterAll, describe, expect, it } from 'vitest';
import { abrirDashboard, cerrarNavegador, irA } from './navegador';

/**
 * RECORRIDO — el cajón del menú tiene que sentirse instantáneo.
 *
 * Historia: el 2026-08-14 se arregló que abrirlo repintara la pantalla de atrás
 * (tirones de 76-90 ms). El 2026-08-25 el dueño volvió a decir que iba "ultra
 * lento", en cualquier pantalla y también en producción. Medido: **0 ms de
 * bloqueo** —nada pesado calculándose— y **531 ms** desde el clic hasta que
 * termina de deslizarse. No era cálculo: era la animación, que venía en 500 ms
 * por defecto de shadcn.
 *
 * Esta prueba vigila las DOS cosas, porque son fallos distintos que se sienten
 * igual: que no haya trabajo bloqueando el hilo, y que la animación no se
 * alargue. Los números absolutos aquí van inflados (Vite en desarrollo), así
 * que el umbral es holgado: lo que se caza es una regresión gorda, no un
 * milisegundo.
 */

afterAll(cerrarNavegador);

/** Con la animación en 200 ms, abrir cuesta ~230. 350 deja aire de sobra. */
const TOPE_MS = 350;
const RONDAS = 5;

describe('el cajón del menú', () => {
  it('abre sin bloquear el hilo y sin animación larga', async () => {
    const { contexto, pagina } = await abrirDashboard();
    await irA(pagina, '/dashboard/perfumes');
    await pagina.getByRole('button', { name: /Abrir menú/ }).waitFor({ timeout: 30_000 });
    // Que la pantalla termine de cargar: se mide el cajón, no la pantalla.
    await pagina.waitForTimeout(2500);

    const tiempos: number[] = [];
    const bloqueos: number[] = [];

    for (let i = 0; i < RONDAS; i++) {
      await pagina.evaluate(() => {
        const w = window as unknown as { __tareas: number[]; __obs?: PerformanceObserver };
        w.__tareas = [];
        w.__obs?.disconnect();
        w.__obs = new PerformanceObserver((lista) => {
          for (const t of lista.getEntries()) w.__tareas.push(t.duration);
        });
        w.__obs.observe({ entryTypes: ['longtask'] });
      });

      const arranque = Date.now();
      await pagina.getByRole('button', { name: /Abrir menú/ }).click();
      await pagina.getByRole('dialog').waitFor({ timeout: 15_000 });
      // Hasta que TERMINA de deslizarse, que es lo que se siente; no hasta que
      // existe en el DOM.
      await pagina.evaluate(() => new Promise<void>((listo) => {
        const panel = document.querySelector('[role=dialog]');
        if (!panel) { listo(); return; }
        panel.addEventListener('animationend', () => listo(), { once: true });
        setTimeout(listo, 3000);
      }));
      tiempos.push(Date.now() - arranque);

      bloqueos.push(await pagina.evaluate(() => {
        const w = window as unknown as { __tareas: number[] };
        return w.__tareas.reduce((s, d) => s + d, 0);
      }));

      await pagina.keyboard.press('Escape');
      await pagina.waitForTimeout(400);
    }

    const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(RONDAS / 2)];

    expect(mediana(tiempos), `abrir tardó ${tiempos.join(', ')} ms`).toBeLessThan(TOPE_MS);
    // Nada pesado detrás: si esto sube, es que el cajón volvió a repintar la
    // pantalla de atrás, como pasaba antes del 2026-08-14.
    expect(mediana(bloqueos), `bloqueos de ${bloqueos.join(', ')} ms`).toBeLessThan(50);

    await contexto.close();
  }, 120_000);
});
