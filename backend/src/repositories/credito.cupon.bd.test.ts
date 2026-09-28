import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearCampanaCupon, crearCliente, limpiarBase } from '../test/baseDePrueba';
import { emitirCodigo } from '../services/anuncio.service';
import { createCredito, deleteCredito, updateCredito } from './credito.repository';

/**
 * EL CUPÓN DE UN CRÉDITO FUNCIONA IGUAL QUE EL DE UNA VENTA (dueño, 2026-09-28).
 *
 * Una vez canjeado queda amarrado: editar el crédito sin el código (o con otro)
 * se rechaza, y solo BORRAR el crédito lo suelta. Antes, en créditos, borrar el
 * texto del campo lo devolvía a "activo" y la persona podía volver a usarlo.
 */
const estado = (codigo: string) =>
  prisma.descuentoCodigo.findUniqueOrThrow({ where: { codigo } }).then((c) => c.estado);

describe('cupón en un crédito', () => {
  beforeEach(limpiarBase);

  const conCupon = async () => {
    const cliente = await crearCliente(`cupon-credito-${Date.now()}@prueba.com`);
    const codigo = await emitirCodigo(cliente.id, (await crearCampanaCupon()).id);
    const datos = { fecha: '2026-09-01', user_id: cliente.id, articulos: 'Un perfume', deuda_inicial: 54000 };
    const credito = await createCredito({ ...datos, codigo_descuento: codigo.codigo });
    return { credito, codigo: codigo.codigo, datos };
  };

  it('editarlo sin el código se rechaza y el cupón sigue canjeado', async () => {
    const { credito, codigo, datos } = await conCupon();
    expect(await estado(codigo)).toBe('canjeado');

    await expect(updateCredito(String(credito.id), { ...datos, codigo_descuento: '' })).rejects.toThrow(/ya canjeó el cupón/);
    expect(await estado(codigo)).toBe('canjeado');
  });

  it('editarlo dejando el MISMO código sí se puede', async () => {
    const { credito, codigo, datos } = await conCupon();
    await updateCredito(String(credito.id), { ...datos, articulos: 'Otro perfume', codigo_descuento: codigo });
    expect(await estado(codigo)).toBe('canjeado');
  });

  it('borrar el crédito sí lo suelta: ahí la compra se deshizo de verdad', async () => {
    const { credito, codigo } = await conCupon();
    await deleteCredito(String(credito.id));
    expect(await estado(codigo)).toBe('activo');
  });
});
