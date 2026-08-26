import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase, sembrarFabricacion30ml } from '../test/baseDePrueba';
import { crearProductoArmado } from './emparejarEsencias.repository';
import { selectParfumsPaginated } from './perfume.repository';

/**
 * DAR DE ALTA UN 1.1 SIN SALIR DE DONDE SE ESTÁ ARMANDO.
 *
 * Es el tercer hermano de un patrón que ya existía dos veces: `enlazarOCrearPerfume`
 * (desde una esencia) y `enlazarOCrearAccesorio` (desde un accesorio). Nace de una
 * barrera medida: el dueño tenía 5 frascos 1.1 sin ficha porque darlos de alta
 * obligaba a salir a otra pantalla y llenar 16 campos, doce de los cuales no
 * aplican. Textual (2026-08-25): *"es una barrera grande"*.
 *
 * Las dos reglas que hereda de sus hermanos, y que este archivo vigila:
 * nace APAGADO (nadie ve una ficha a medio llenar) y un nombre que ya existe
 * NO se toca: se avisa y decide el dueño.
 */

describe('crear un 1.1 desde el lote', () => {
  beforeEach(limpiarBase);

  const envasePremium = () => crearInsumo('Envase Bon Bon 1.1 100ml', {
    tipo: 'envase', precio: 59498, stock: 5,
  });

  it('nace apagado, solo_armado y con su talla y su envase', async () => {
    const s = await sembrarFabricacion30ml();
    const envase = await envasePremium();

    const res = await crearProductoArmado({
      nombre: 'Bon Bon 1.1',
      precio: 150000,
      presentacion_id: s.presentacion.id,
      envase_insumo_id: envase.id,
      insumo_esencia_id: s.esencia.id,
    });

    expect(res.accion).toBe('creado');
    const p = await prisma.perfume.findUniqueOrThrow({
      where: { id: res.id },
      include: { presentaciones: true },
    });
    expect(p.publicado).toBe(false);
    expect(p.solo_armado).toBe(true);
    expect(p.tipo_producto).toBe('fabricado');
    expect(p.insumo_esencia_id).toBe(s.esencia.id);
    expect(p.presentaciones).toHaveLength(1);
    expect(p.presentaciones[0].presentacion_id).toBe(s.presentacion.id);
    // El envase premium es lo que hace que un 1.1 cueste el doble: si no queda
    // enganchado a SU talla, el costo sale con el frasco corriente.
    expect(p.presentaciones[0].envase_insumo_id).toBe(envase.id);
  });

  it('uno comprado hecho no pide esencia y queda como comprado', async () => {
    const s = await sembrarFabricacion30ml();
    const envase = await envasePremium();

    const res = await crearProductoArmado({
      nombre: 'Splash Yara 1.1',
      precio: 120000,
      presentacion_id: s.presentacion.id,
      envase_insumo_id: envase.id,
      comprado: true,
    });

    const p = await prisma.perfume.findUniqueOrThrow({ where: { id: res.id } });
    expect(p.tipo_producto).toBe('comprado');
    expect(p.solo_armado).toBe(true);
    expect(p.insumo_esencia_id).toBeNull();
  });

  it('aparece en la pestaña Productos, no en Perfumes', async () => {
    const s = await sembrarFabricacion30ml();

    await crearProductoArmado({
      nombre: 'Khamrah 1.1',
      precio: 150000,
      presentacion_id: s.presentacion.id,
      insumo_esencia_id: s.esencia.id,
    });

    const productos = await selectParfumsPaginated(1, 50, undefined, undefined, true, undefined, 'productos');
    const fabricadas = await selectParfumsPaginated(1, 50, undefined, undefined, true, undefined, 'fabricadas');
    expect(productos.data.map((p) => p.nombre)).toContain('Khamrah 1.1');
    expect(fabricadas.data.map((p) => p.nombre)).not.toContain('Khamrah 1.1');
  });

  it('un nombre que ya existe avisa y NO crea otra ficha', async () => {
    const s = await sembrarFabricacion30ml();
    const primero = await crearProductoArmado({
      nombre: 'Bon Bon 1.1',
      precio: 150000,
      presentacion_id: s.presentacion.id,
      insumo_esencia_id: s.esencia.id,
    });

    // Mismo nombre escrito distinto: tildes, mayúsculas y espacios de más. Sin
    // esto acabaríamos con "Bon Bon 1.1" y "bon bón  1.1" como dos fichas, con
    // el stock partido entre las dos.
    const segundo = await crearProductoArmado({
      nombre: '  bon bón  1.1 ',
      precio: 150000,
      presentacion_id: s.presentacion.id,
      insumo_esencia_id: s.esencia.id,
    });

    expect(segundo.accion).toBe('ya_existe');
    expect(segundo.id).toBe(primero.id);
    expect(await prisma.perfume.count({ where: { solo_armado: true } })).toBe(1);
  });

  it('exige nombre y precio, que es lo mínimo para que el frasco tenga costo y se pueda vender', async () => {
    const s = await sembrarFabricacion30ml();
    const base = { presentacion_id: s.presentacion.id, insumo_esencia_id: s.esencia.id };

    await expect(crearProductoArmado({ ...base, nombre: '   ', precio: 150000 }))
      .rejects.toThrow(/nombre/i);
    await expect(crearProductoArmado({ ...base, nombre: 'Sin precio 1.1', precio: 0 }))
      .rejects.toThrow(/precio/i);
  });
});

/**
 * LA FICHA SE COPIA DEL PERFUME CORRIENTE.
 *
 * Un 1.1 y su corriente son el mismo jugo: descripción, notas, ocasiones,
 * género, duración y proyección son idénticas. Escribirlas otra vez es la
 * fricción que tiene al dueño con 229 perfumes y CERO fichas 1.1.
 *
 * Copia y no enlace: son dos productos que se venden distinto (otro frasco,
 * otro precio, otra foto), y un enlace vivo obligaría a decidir cuál manda el
 * día que se separen.
 */
describe('el 1.1 hereda la ficha de su perfume corriente', () => {
  beforeEach(limpiarBase);

  it('copia lo que comparten y NO copia precio, foto ni publicado', async () => {
    const s = await sembrarFabricacion30ml();
    const aroma = await prisma.tipoAroma.create({ data: { nombre: 'Dulce' } });
    const ocasion = await prisma.ocasion.create({ data: { nombre: 'Noche' } });
    const corriente = await prisma.perfume.create({
      data: {
        nombre: 'Khamrah By Lattafa',
        precio: 90000,
        descripcion: 'Canela y vainilla',
        duracion: '8 horas',
        proyeccion: 'Alta',
        genero: 'unisex',
        imagen_url: '/uploads/khamrah.webp',
        tipos_aroma: { create: { tipo_aroma_id: aroma.id } },
        ocasiones: { create: { ocasion_id: ocasion.id } },
      },
    });

    const res = await crearProductoArmado({
      nombre: 'Khamrah 1.1',
      precio: 150000,
      presentacion_id: s.presentacion.id,
      copiar_de_perfume_id: corriente.id,
    });

    const creado = await prisma.perfume.findUniqueOrThrow({
      where: { id: res.id }, include: { tipos_aroma: true, ocasiones: true },
    });
    expect(res.accion).toBe('creado');
    expect(creado.descripcion).toBe('Canela y vainilla');
    expect(creado.duracion).toBe('8 horas');
    expect(creado.proyeccion).toBe('Alta');
    expect(creado.genero).toBe('unisex');
    expect(creado.tipos_aroma).toHaveLength(1);
    expect(creado.ocasiones).toHaveLength(1);

    // La foto SÍ se hereda: es el mismo jugo y el mismo frasco de referencia, y
    // una ficha sin imagen se ve rota en la tienda (decisión del dueño,
    // 2026-08-25, al ver los 6 lotes por enlazar en producción).
    expect(creado.imagen_url).toBe('/uploads/khamrah.webp');
    // Lo que NO se hereda: el precio, porque un 1.1 vale otra cosa.
    expect(Number(creado.precio)).toBe(150000);
    expect(creado.publicado).toBe(false);
    expect(creado.solo_armado).toBe(true);
  });

  it('sin perfume del que copiar, la ficha nace vacía y no revienta', async () => {
    const s = await sembrarFabricacion30ml();

    const res = await crearProductoArmado({
      nombre: 'Un 1.1 sin padre', precio: 150000, presentacion_id: s.presentacion.id,
    });

    const creado = await prisma.perfume.findUniqueOrThrow({ where: { id: res.id } });
    expect(creado.descripcion).toBeNull();
    expect(creado.genero).toBeNull();
  });
});
