import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../../test/baseDePrueba';
import { importarCatalogo } from './catalogo';

/**
 * CARGAR 1.1 POR EXCEL.
 *
 * El dueño lo pidió el 2026-08-25 junto con el alta de uno en uno: *"que se
 * puedan meter tanto varios en una misma tanda en el mismo modal como subir un
 * excel para esos"*. Sin las tres columnas nuevas, un 1.1 importado entraba como
 * un perfume corriente: publicado en la tienda, sin envase premium y sin la
 * regla de "solo se vende si está armado", que es lo que lo hace un 1.1.
 */

const resultado = () => ({ insertados: 0, actualizados: 0, omitidos: 0, errores: [] as string[] });

describe('importar 1.1 por Excel', () => {
  beforeEach(limpiarBase);

  it('crea el producto armado con su envase, su esencia y apagado', async () => {
    const s = await sembrarFabricacion30ml();
    const envase = await crearInsumo('Envase Bon Bon 1.1 100ml', { tipo: 'envase', precio: 59498 });
    const r = resultado();

    await importarCatalogo('perfumes', [{
      nombre: 'Bon Bon 1.1',
      precio: 150000,
      presentaciones: '30ml',
      solo_armado: 'si',
      envase: 'Envase Bon Bon 1.1 100ml',
      esencia: 'Eternity – Esencia',
    }], r);

    expect(r.errores).toEqual([]);
    expect(r.insertados).toBe(1);

    const p = await prisma.perfume.findFirstOrThrow({
      where: { nombre: 'Bon Bon 1.1' }, include: { presentaciones: true },
    });
    expect(p.solo_armado).toBe(true);
    // Nace apagado: una ficha importada a medias no puede salir a la tienda.
    expect(p.publicado).toBe(false);
    expect(p.insumo_esencia_id).toBe(s.esencia.id);
    expect(p.presentaciones[0].envase_insumo_id).toBe(envase.id);
  });

  it('un perfume normal sigue entrando publicado y sin tocar nada de esto', async () => {
    const r = resultado();

    await importarCatalogo('perfumes', [{ nombre: 'Eros', precio: 60000 }], r);

    const p = await prisma.perfume.findFirstOrThrow({ where: { nombre: 'Eros' } });
    expect(p.publicado).toBe(true);
    expect(p.solo_armado).toBe(false);
  });

  it('un envase o una esencia que no existen no tumban la fila: entra y se avisa', async () => {
    const r = resultado();

    await importarCatalogo('perfumes', [{
      nombre: 'Yum Yum 1.1',
      precio: 150000,
      presentaciones: '30ml',
      solo_armado: 'si',
      envase: 'Envase que no existe',
      esencia: 'Esencia que no existe',
    }], r);

    // La ficha se crea igual —el dueño la completa después—, pero el aviso dice
    // qué le faltó: en silencio, ese 1.1 costaría como uno corriente.
    expect(r.insertados).toBe(1);
    expect(r.errores.join(' ')).toMatch(/Envase que no existe/);
    expect(r.errores.join(' ')).toMatch(/Esencia que no existe/);
  });
});
