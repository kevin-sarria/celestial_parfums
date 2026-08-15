import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { createPresentacion, updatePresentacion } from './perfume.repository';

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
