import { beforeEach, describe, expect, it } from 'vitest';
import { limpiarBase } from '../test/baseDePrueba';
import { actualizar, borrar, crear, listar, listarTodas } from './mensaje.service';

/**
 * EL MAESTRO DE MENSAJES.
 *
 * Lo que el servidor garantiza: que **nace vacío** —el sistema no inventa la voz
 * del dueño—, que cada caso tiene los suyos, y que una variante nueva cae AL
 * FINAL y no se cuela entre las que él ya ordenó.
 */
const base = {
  caso: 'credito' as const,
  texto: 'ey {nombre}, tu crédito {vence} — son {saldo}',
};

describe('el maestro de mensajes', () => {
  beforeEach(limpiarBase);

  it('nace vacío: sin mensajes escritos no hay nada que mandar', async () => {
    expect(await listar('credito')).toEqual([]);
  });

  it('guarda el mensaje con su caso', async () => {
    const p = await crear({ ...base, nombre: 'Relajado' });
    expect(p).toMatchObject({ caso: 'credito', nombre: 'Relajado', texto: base.texto });
    expect(await listar('credito')).toHaveLength(1);
  });

  it('la nueva cae al final, no entre las que él ya ordenó', async () => {
    await crear({ ...base, nombre: 'Primera' });
    await crear({ ...base, nombre: 'Segunda' });
    await crear({ ...base, nombre: 'Tercera' });
    expect((await listar('credito')).map((m) => m.nombre)).toEqual(['Primera', 'Segunda', 'Tercera']);
  });

  it('cada caso tiene los suyos', async () => {
    await crear({ ...base, nombre: 'Cobro' });
    expect(await listar('otro')).toEqual([]);
    expect(await listarTodas()).toHaveLength(1);
  });

  it('se corrige el texto sin perder el nombre', async () => {
    const p = await crear({ ...base, nombre: 'Formal' });
    const corregido = await actualizar(p.id, { ...base, nombre: 'Muy formal', texto: 'Buen día {nombre}' });
    expect(corregido).toMatchObject({ nombre: 'Muy formal', texto: 'Buen día {nombre}' });
    expect(await listar('credito')).toHaveLength(1);
  });

  it('borrarlo lo saca de la lista', async () => {
    const p = await crear({ ...base, nombre: 'Efímero' });
    await borrar(p.id);
    expect(await listar('credito')).toEqual([]);
  });
});
