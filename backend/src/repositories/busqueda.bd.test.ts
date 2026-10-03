import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { limpiarBase } from '../test/baseDePrueba';
import { buscarEnTodo } from './busqueda.repository';

describe('el buscador general del panel', () => {
  beforeEach(limpiarBase);

  it('encuentra de una vez la ficha, la clienta y su venta, y dice a qué pestaña llevar', async () => {
    const rol = await prisma.role.create({ data: { id: 2, nombre: 'cliente' } });
    await prisma.user.create({ data: { nombre: 'Laura', apellido: 'Khamrah', email: 'l@x.co', password: 'x', rol_id: rol.id } });
    await prisma.perfume.create({ data: { nombre: 'Khamrah', precio: 60000 } });
    await prisma.perfume.create({ data: { nombre: 'Khamrah 1.1', precio: 180000, solo_armado: true } });
    const venta = await prisma.venta.create({
      data: { dia: new Date('2026-09-10'), persona: 'Ana', cantidad_perfumes: 1, presentacion: '30ML', referencia_perfume: 'Khamrah', valor_venta: 60000 },
    });

    const r = await buscarEnTodo('khamrah');
    expect(r.filter((x) => x.grupo === 'Catálogo').map((x) => x.tab)).toEqual(['perfumes', 'productos']);
    expect(r.find((x) => x.grupo === 'Clientes')?.tab).toBe('usuarios');
    expect(r.find((x) => x.grupo === 'Ventas')?.detalle).toBe('10/09/2026 · $60.000 · Khamrah');

    // Por número, la venta exacta
    expect((await buscarEnTodo(`#${venta.id}`)).filter((x) => x.grupo === 'Ventas')).toHaveLength(1);
  });

  it('con menos de 2 letras no busca', async () => {
    expect(await buscarEnTodo('k')).toEqual([]);
  });
});
