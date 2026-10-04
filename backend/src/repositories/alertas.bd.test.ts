import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearInsumo, limpiarBase } from '../test/baseDePrueba';
import { calcularReposicion } from './reposicion.repository';
import { alertasDisparadas, guardarAlerta, listarAlertas } from './alertas.repository';

/**
 * ALERTAS DE INVENTARIO Y MATERIALES EN PRUEBA.
 *
 * Nacen de dos quejas del dueño el mismo día (2026-08-29):
 *
 * 1. Trajo 30 ml de una esencia nueva para ver si sale, gastó 5 en una muestra
 *    y el pedido sugerido se la empezó a pedir —con el mínimo en 30— sin haber
 *    vendido una sola unidad. *"Para mí eso no es prioritario porque está en una
 *    fase de prueba para ver si sale la esencia o no."*
 * 2. Poner el mínimo material por material no lo hace nadie (se midió: 1 de 226
 *    lo tenía), así que quiere un mínimo **por familia** y que al cruzarlo le
 *    salte un aviso grande en el dashboard.
 *
 * La decisión que ata las dos cosas: **el mínimo de la familia y el umbral del
 * aviso son el MISMO número**. En su cabeza lo son, y guardarlo dos veces
 * garantiza que un día digan cosas distintas.
 */

const sembrarGama = () =>
  prisma.gamaEsencia.create({ data: { nombre: 'Árabe', stock_minimo: 50 } });

describe('materiales en prueba', () => {
  beforeEach(limpiarBase);

  it('un material EN PRUEBA no se sugiere, aunque esté bajo mínimo', async () => {
    const gama = await sembrarGama();
    const nueva = await crearInsumo('Esencia nueva de prueba', { gama_id: gama.id, stock: 25 });
    await prisma.insumoCosto.update({ where: { id: nueva.id }, data: { en_prueba: true } });
    // La misma situación, pero sin marcar: esta SÍ tiene que salir, o la prueba
    // pasaría por estar vacía la lista entera.
    await crearInsumo('Esencia de siempre', { gama_id: gama.id, stock: 25 });

    const r = await calcularReposicion();

    expect(r.esencias.map((f) => f.nombre)).toEqual(['Esencia de siempre']);
    // No se esconde: se dice cuántas hay guardadas, para que no se olviden.
    expect(r.en_prueba.map((m) => m.nombre)).toEqual(['Esencia nueva de prueba']);
  });

  it('al desmarcarla vuelve al pedido sugerido', async () => {
    const gama = await sembrarGama();
    const nueva = await crearInsumo('Esencia nueva de prueba', { gama_id: gama.id, stock: 25 });
    await prisma.insumoCosto.update({ where: { id: nueva.id }, data: { en_prueba: true } });
    expect((await calcularReposicion()).esencias).toHaveLength(0);

    await prisma.insumoCosto.update({ where: { id: nueva.id }, data: { en_prueba: false } });

    const r = await calcularReposicion();
    expect(r.esencias.map((f) => f.nombre)).toEqual(['Esencia nueva de prueba']);
    expect(r.en_prueba).toEqual([]);
  });
});

describe('mínimo por familia, en cascada', () => {
  beforeEach(limpiarBase);

  it('el mínimo de la familia cubre lo que no tiene ni propio ni de gama', async () => {
    // Un envase nunca tuvo mínimo: hoy no se avisa de él jamás.
    await crearInsumo('Envase 100 ml', { tipo: 'envase', stock: 4 });
    expect((await calcularReposicion()).implementos).toHaveLength(0);

    await guardarAlerta({ ambito: 'envases', minimo: 10, forma: 'franja', activo: true });

    const fila = (await calcularReposicion()).implementos[0];
    expect(fila?.nombre).toBe('Envase 100 ml');
    expect(fila?.minimo).toBe(10);
    expect(fila?.minimo_heredado).toBe(true);
  });

  it('manda el mínimo propio del material, después el de su gama, después el de la familia', async () => {
    const gama = await sembrarGama();
    await guardarAlerta({ ambito: 'esencias', minimo: 10, forma: 'franja', activo: true });

    const propio = await crearInsumo('Con mínimo propio', { gama_id: gama.id, stock: 25 });
    await prisma.insumoCosto.update({ where: { id: propio.id }, data: { stock_minimo: 100 } });
    await crearInsumo('Sin mínimo propio', { gama_id: gama.id, stock: 25 });
    await crearInsumo('Sin gama ni mínimo', { tipo: 'accesorio', stock: 1 });

    const r = await calcularReposicion();
    const porNombre = new Map([...r.esencias, ...r.implementos].map((f) => [f.nombre, f]));

    expect(porNombre.get('Con mínimo propio')?.minimo).toBe(100); // el suyo
    expect(porNombre.get('Sin mínimo propio')?.minimo).toBe(50);  // el de la gama
  });

  it('"esencias" NO alcanza al diluyente: solo a la materia prima con gama', async () => {
    const gama = await sembrarGama();
    await guardarAlerta({ ambito: 'esencias', minimo: 100, forma: 'franja', activo: true });
    await crearInsumo('Esencia Khamrah', { gama_id: gama.id, stock: 20 });
    // El diluyente es materia prima y NO tiene gama: se compra por litros y
    // medirlo con la vara de una esencia llenaría la alerta de ruido.
    await crearInsumo('Diluyente', { stock: 20 });

    const nombres = (await calcularReposicion()).esencias.map((f) => f.nombre);
    expect(nombres).toContain('Esencia Khamrah');
    expect(nombres).not.toContain('Diluyente');
  });
});

describe('la alerta del dashboard', () => {
  beforeEach(limpiarBase);

  it('dice qué familia está bajo mínimo, con cuántos y cómo avisar', async () => {
    await guardarAlerta({ ambito: 'envases', minimo: 10, forma: 'ventana', activo: true });
    await crearInsumo('Envase 100 ml', { tipo: 'envase', stock: 4 });
    await crearInsumo('Envase 30 ml', { tipo: 'envase', stock: 2 });
    await crearInsumo('Envase 50 ml', { tipo: 'envase', stock: 99 });

    const [alerta] = await alertasDisparadas();
    expect(alerta.ambito).toBe('envases');
    expect(alerta.forma).toBe('ventana');
    expect(alerta.materiales.map((m) => m.nombre).sort())
      .toEqual(['Envase 100 ml', 'Envase 30 ml']);
  });

  it('no dispara nada si no hay nada bajo mínimo', async () => {
    await guardarAlerta({ ambito: 'envases', minimo: 10, forma: 'franja', activo: true });
    await crearInsumo('Envase 100 ml', { tipo: 'envase', stock: 99 });

    expect(await alertasDisparadas()).toEqual([]);
  });

  it('una alerta apagada no dispara, y un material en prueba no la dispara', async () => {
    await guardarAlerta({ ambito: 'envases', minimo: 10, forma: 'franja', activo: false });
    await crearInsumo('Envase 100 ml', { tipo: 'envase', stock: 1 });
    expect(await alertasDisparadas()).toEqual([]);

    await guardarAlerta({ ambito: 'implementos', minimo: 10, forma: 'franja', activo: true });
    const prueba = await crearInsumo('Perfumero de prueba', { tipo: 'accesorio', stock: 1 });
    await prisma.insumoCosto.update({ where: { id: prueba.id }, data: { en_prueba: true } });
    expect(await alertasDisparadas()).toEqual([]);
  });

  it('guardar dos veces la misma familia corrige la regla, no crea una segunda', async () => {
    await guardarAlerta({ ambito: 'esencias', minimo: 30, forma: 'franja', activo: true });
    await guardarAlerta({ ambito: 'esencias', minimo: 45, forma: 'ventana', activo: true });

    const todas = await listarAlertas();
    expect(todas).toHaveLength(1);
    expect(todas[0].minimo).toBe(45);
    expect(todas[0].forma).toBe('ventana');
  });
});

describe('frascos de una fragancia (los de los 1.1)', () => {
  beforeEach(limpiarBase);

  /**
   * Dueño, 2026-10-03: *"no es posible que me pida 40 envases de perfumes 1.1
   * cuando se sabe que por ser de lujo salen super lento"*. El frasco que solo
   * está asignado a un perfume tiene su propia familia; el que usa la receta de
   * un tamaño sigue siendo genérico aunque también esté asignado.
   */
  it('el mínimo de los envases genéricos no alcanza al frasco de un 1.1', async () => {
    const generico = await crearInsumo('Envase 100 ml', { tipo: 'envase', stock: 5 });
    const frasco11 = await crearInsumo('Envase Yara 1.1', { tipo: 'envase', stock: 1 });
    await prisma.formulaVolumen.create({ data: { nombre: '100 ml', ml_total: 100, esencia_ml: 30, envase_insumo_id: generico.id } });
    const perfume = await prisma.perfume.create({ data: { nombre: 'Yara 1.1', precio: 90000 } });
    const talla = await prisma.presentacion.create({ data: { nombre: '100MLT', ml: 100 } });
    await prisma.perfumePresentacion.create({ data: { perfume_id: perfume.id, presentacion_id: talla.id, envase_insumo_id: frasco11.id } });
    await guardarAlerta({ ambito: 'envases', minimo: 40, forma: 'franja', activo: true });

    const disparadas = await alertasDisparadas();
    expect(disparadas.map((a) => [a.ambito, a.materiales.map((m) => m.nombre)])).toEqual([['envases', ['Envase 100 ml']]]);
    expect((await calcularReposicion()).implementos.map((f) => f.nombre)).toEqual(['Envase 100 ml']);

    // Con su propio número, sí avisa
    await guardarAlerta({ ambito: 'frascos_fragancia', minimo: 2, forma: 'franja', activo: true });
    const conNumero = await alertasDisparadas();
    expect(conNumero.find((a) => a.ambito === 'frascos_fragancia')?.materiales.map((m) => m.nombre)).toEqual(['Envase Yara 1.1']);
  });
});

describe('aviso por velocidad (opción C, 2026-10-04)', () => {
  beforeEach(limpiarBase);

  it('avisa lo que alcanza para menos de 2 semanas aunque esté lejos de su mínimo', async () => {
    const { aplicarMovimiento } = await import('./inventario.repository');
    const { hoyEnColombia } = await import('../utils/fechas');
    // 100 bolsas; se vendieron 90 en los últimos días → 1 al día, quedan 10 → alcanza para 10 días
    const rapida = await crearInsumo('Bolsa que vuela', { tipo: 'accesorio', stock: 100 });
    const lenta = await crearInsumo('Tarjeta que no sale', { tipo: 'accesorio', stock: 10 });
    await prisma.$transaction((tx) => aplicarMovimiento(tx, { insumo_id: rapida.id, tipo: 'venta', cantidad: -90, fecha: hoyEnColombia() }));
    // El mínimo de la familia (2) está lejos de las 10 que quedan: solo la velocidad puede avisar
    await guardarAlerta({ ambito: 'implementos', minimo: 2, forma: 'franja', activo: true });

    const alerta = (await alertasDisparadas()).find((a) => a.ambito === 'implementos');
    expect(alerta?.materiales.map((m) => [m.nombre, m.dias_alcanza])).toEqual([['Bolsa que vuela', 10]]);

    const pedido = await calcularReposicion();
    expect(pedido.implementos.map((f) => f.nombre)).toEqual(['Bolsa que vuela']);
    expect(pedido.implementos[0].dias_alcanza).toBe(10);
    expect(lenta.id).toBeGreaterThan(0);
  });
});
