import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { createCombo, deleteCombo, getAllCombos, updateCombo } from './combo.service';
import { deletePerfume } from '../repositories/perfume.repository';

/**
 * EL KIT DEL COMBO (ola 2 de los regalos, 2026-09-28): los accesorios que un
 * combo trae por defecto. Aquí se prueba lo que guarda el servidor; que la
 * venta los ofrezca como regalo se prueba en el recorrido `kitCombo.e2e`.
 */
const accesorio = (nombre: string) =>
  prisma.perfume.create({ data: { nombre, precio: 5000, tipo_producto: 'comprado', es_accesorio: true } });

const combo = { nombre: '3 de 30 ml', cantidad: 3, precio: 150000 };

describe('el kit del combo', () => {
  beforeEach(limpiarBase);

  it('guarda los accesorios y los devuelve con su nombre', async () => {
    const perfumero = await accesorio('Perfumero recargable');
    const bolsa = await accesorio('Bolsa');
    await createCombo({ ...combo, contenido: [{ perfume_id: perfumero.id, cantidad: 1 }, { perfume_id: bolsa.id, cantidad: 2 }] });

    const [c] = await getAllCombos();
    expect(c.contenido).toEqual([
      { perfume_id: perfumero.id, nombre: 'Perfumero recargable', cantidad: 1, publicado: true },
      { perfume_id: bolsa.id, nombre: 'Bolsa', cantidad: 2, publicado: true },
    ]);
  });

  it('solo lleva accesorios: una fragancia se rechaza', async () => {
    const fragancia = await prisma.perfume.create({ data: { nombre: 'Khamrah', precio: 60000 } });
    await expect(createCombo({ ...combo, contenido: [{ perfume_id: fragancia.id, cantidad: 1 }] }))
      .rejects.toThrow(/solo puede llevar accesorios/);
  });

  it('el mismo accesorio dos veces se rechaza', async () => {
    const bolsa = await accesorio('Bolsa');
    await expect(createCombo({ ...combo, contenido: [{ perfume_id: bolsa.id, cantidad: 1 }, { perfume_id: bolsa.id, cantidad: 1 }] }))
      .rejects.toThrow(/aparece dos veces/);
  });

  it('editar reemplaza el kit, y sin `contenido` no lo toca', async () => {
    const perfumero = await accesorio('Perfumero recargable');
    const bolsa = await accesorio('Bolsa');
    const id = await createCombo({ ...combo, contenido: [{ perfume_id: perfumero.id, cantidad: 1 }] });

    await updateCombo(String(id), { ...combo, contenido: [{ perfume_id: bolsa.id, cantidad: 3 }] });
    expect((await getAllCombos())[0].contenido.map((k) => [k.nombre, k.cantidad])).toEqual([['Bolsa', 3]]);

    await updateCombo(String(id), { ...combo, precio: 140000 });
    expect((await getAllCombos())[0].contenido).toHaveLength(1);
  });

  it('un accesorio que va en un kit no se puede borrar; borrar el combo sí se lleva su kit', async () => {
    const bolsa = await accesorio('Bolsa');
    const id = await createCombo({ ...combo, contenido: [{ perfume_id: bolsa.id, cantidad: 1 }] });

    await expect(deletePerfume(String(bolsa.id))).rejects.toThrow(/kit del combo "3 de 30 ml"/);

    await deleteCombo(String(id));
    expect(await prisma.comboContenido.count()).toBe(0);
    await expect(deletePerfume(String(bolsa.id))).resolves.toBeTruthy();
  });
});
