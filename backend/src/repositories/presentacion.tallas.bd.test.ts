import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { createPresentacion, updatePresentacion } from './clasificacion.repository';
import { actualizarFormula, crearFormula } from './costeo.repository';

/**
 * UNA TALLA NUEVA NACE SABIENDO SUS MILILITROS.
 *
 * Crear una talla guardaba **solo el nombre**: un "90 ML" quedaba con
 * `ml = NULL`, y una talla sin número el sistema la trata como "no es un
 * tamaño" — no la enlaza con ninguna receta y **no la costea**, así que cada
 * venta suya entra con costo cero y la ganancia del mes sale inflada.
 *
 * Se destapó cargando los ORIGINALES, que vienen en tamaños que hoy no existen
 * en la lista (90 ml, 125 ml…) y que el dueño crea él mismo desde
 * Clasificaciones.
 */

const leer = (id: number) => prisma.presentacion.findUniqueOrThrow({ where: { id } });

/** Una receta de N ml, para comprobar que la talla se le engancha sola. */
const sembrarReceta = async (ml: number) => {
  const envase = await crearInsumo(`Envase ${ml} ml`, { tipo: 'envase', precio: 2850 });
  return prisma.formulaVolumen.create({
    data: {
      nombre: `${ml} ml`,
      ml_total: ml,
      esencia_ml: ml / 2,
      sellador_ml: 0.4,
      feromonas_ml: 0.3,
      envase_insumo_id: envase.id,
    },
  });
};

describe('crear una talla', () => {
  beforeEach(limpiarBase);

  it('deduce los ml de su nombre', async () => {
    const id = await createPresentacion('90 ML');

    expect((await leer(id)).ml).toBe(90);
  });

  it('se engancha sola a la receta de ese tamaño', async () => {
    const receta = await sembrarReceta(100);

    const id = await createPresentacion('100ml');

    expect((await leer(id)).formula_volumen_id).toBe(receta.id);
  });

  it('sin receta de ese tamaño se queda con el número y sin enlace', async () => {
    // El caso de los originales: el dueño crea la talla mucho antes de que
    // exista una receta de 125 ml (y puede que nunca exista: no los fabrica).
    const id = await createPresentacion('125 ML');

    const fila = await leer(id);
    expect(fila.ml).toBe(125);
    expect(fila.formula_volumen_id).toBe(null);
  });

  it('lo que no es un tamaño se queda sin número', async () => {
    const id = await createPresentacion('Combo Personalizado');

    expect((await leer(id)).ml).toBe(null);
  });
});

describe('renombrar una talla', () => {
  beforeEach(limpiarBase);

  it('recalcula el número y el enlace', async () => {
    // El caso real que queda pendiente: separar "200/250ML" en dos tallas.
    const receta = await sembrarReceta(200);
    const id = await createPresentacion('200/250ML');
    expect((await leer(id)).ml).toBe(null);

    await updatePresentacion(String(id), '200 ML');

    const fila = await leer(id);
    expect(fila.ml).toBe(200);
    expect(fila.formula_volumen_id).toBe(receta.id);
  });

  it('un nombre sin número NO borra el que ya tenía', async () => {
    // Renombrar "30ml" a "Frasco chico" dejaría de costear esa talla en
    // silencio. Si el dueño quiere cambiarle el tamaño, lo escribe.
    const receta = await sembrarReceta(30);
    const id = await createPresentacion('30ml');

    await updatePresentacion(String(id), 'Frasco chico');

    const fila = await leer(id);
    expect(fila.nombre).toBe('Frasco chico');
    expect(fila.ml).toBe(30);
    expect(fila.formula_volumen_id).toBe(receta.id);
  });
});

describe('crear una receta', () => {
  beforeEach(limpiarBase);

  /** La receta tal como la manda la pantalla de *Tamaños y fórmulas*. */
  const receta = (ml: number, envaseId: number) => crearFormula({
    nombre: `${ml} ml`,
    ml_total: ml,
    esencia_ml: ml / 2,
    sellador_ml: 0.4,
    feromonas_ml: 0.3,
    envase_insumo_id: envaseId,
  });

  it('engancha las tallas de ese tamaño que estaban sueltas', async () => {
    // El caso que viene: el dueño va a separar "200/250ML" en dos tallas
    // reales, y las recetas de 200 y 250 ml todavía no existen. Si crear la
    // receta no las engancha, esas tallas se quedan sin costear PARA SIEMPRE:
    // cada venta suya entra con costo cero y la ganancia del mes sale inflada.
    const envase = await crearInsumo('Envase 200 ml', { tipo: 'envase', precio: 3200 });
    const talla = await createPresentacion('200 ML');
    expect((await leer(talla)).formula_volumen_id).toBe(null);

    const nueva = await receta(200, envase.id);

    expect((await leer(talla)).formula_volumen_id).toBe(nueva.id);
  });

  it('no le quita a una talla la receta que ya tenía', async () => {
    // Solo se rellenan huecos. Pisar un enlace existente cambiaría en silencio
    // qué materiales gasta esa talla al venderse.
    const envase = await crearInsumo('Envase 30 ml', { tipo: 'envase', precio: 2850 });
    const primera = await sembrarReceta(30);
    const talla = await createPresentacion('30ML');
    expect((await leer(talla)).formula_volumen_id).toBe(primera.id);

    await receta(30, envase.id);

    expect((await leer(talla)).formula_volumen_id).toBe(primera.id);
  });

  it('no toca lo que no es un tamaño', async () => {
    const envase = await crearInsumo('Envase suelto', { tipo: 'envase', precio: 1000 });
    const combo = await createPresentacion('Combo Personalizado');

    await receta(50, envase.id);

    expect((await leer(combo)).formula_volumen_id).toBe(null);
  });
});

describe('cambiarle los mililitros a una receta', () => {
  beforeEach(limpiarBase);

  /** La receta tal como la manda la pantalla, con los ml que se le pidan. */
  const datos = (ml: number, envaseId: number) => ({
    nombre: `${ml} ml`,
    ml_total: ml,
    esencia_ml: ml / 2,
    sellador_ml: 0.4,
    feromonas_ml: 0.3,
    envase_insumo_id: envaseId,
  });

  it('se rechaza si alguna talla la está usando', async () => {
    // Decisión del dueño (2026-08-23): antes que reenganchar solo. Cambiar los
    // ml de una receta enganchada hace que vender un frasco de 200 descuente
    // material de 250 — y eso pasaría sin que nadie lo vea. Para otro tamaño,
    // receta nueva.
    const envase = await crearInsumo('Envase 200 ml', { tipo: 'envase', precio: 3200 });
    const talla = await createPresentacion('200 ML');
    const receta = await crearFormula(datos(200, envase.id));
    expect((await leer(talla)).formula_volumen_id).toBe(receta.id);

    await expect(actualizarFormula(receta.id, datos(250, envase.id)))
      .rejects.toThrow(/200 ML/);

    const sinTocar = await prisma.formulaVolumen.findUniqueOrThrow({ where: { id: receta.id } });
    expect(sinTocar.ml_total).toBe(200);
  });

  it('deja cambiar lo demás de una receta enganchada', async () => {
    const envase = await crearInsumo('Envase 30 ml', { tipo: 'envase', precio: 2850 });
    const talla = await createPresentacion('30ML');
    const receta = await crearFormula(datos(30, envase.id));
    expect((await leer(talla)).formula_volumen_id).toBe(receta.id);

    await actualizarFormula(receta.id, { ...datos(30, envase.id), nombre: '30 ml (corregida)', esencia_ml: 16 });

    const guardada = await prisma.formulaVolumen.findUniqueOrThrow({ where: { id: receta.id } });
    expect(guardada.nombre).toBe('30 ml (corregida)');
    expect(Number(guardada.esencia_ml)).toBe(16);
  });

  it('sin tallas enganchadas se puede corregir el tamaño, y agarra las de ese número', async () => {
    // El caso del dedazo: la receta se acaba de crear con el número mal.
    const envase = await crearInsumo('Envase 50 ml', { tipo: 'envase', precio: 3000 });
    const receta = await crearFormula(datos(500, envase.id));
    const talla = await createPresentacion('50 ML');
    expect((await leer(talla)).formula_volumen_id).toBe(null);

    await actualizarFormula(receta.id, datos(50, envase.id));

    expect((await leer(talla)).formula_volumen_id).toBe(receta.id);
  });
});
