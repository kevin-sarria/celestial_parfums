import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma';
import { crearCliente, limpiarBase } from '../test/baseDePrueba';
import { createCredito } from './credito.repository';

/**
 * LA FECHA LÍMITE DE UN CRÉDITO SE CUENTA EN DÍAS.
 *
 * El acuerdo por defecto es de **30 días de calendario** (decidido por el dueño
 * el 2026-08-23; el porqué está en `utils/fechas.ts`). Antes se hacía con
 * `setMonth(+1)`, que en los días 29, 30 y 31 se desbordaba: un crédito del 31
 * de enero vencía el **3 de marzo**, o sea 31 días de plazo y un día más para
 * marcarse vencido.
 *
 * Esto prueba el ENGANCHE, no la aritmética (esa vive en `fechas.test.ts`):
 * que la fecha que se guarda de verdad al crear un crédito sea esa.
 */

const dia = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

const credito = async (fecha: string, fecha_limite?: string) => {
  const cliente = await crearCliente(`plazo-${Date.now()}-${Math.random()}@prueba.com`);
  const row = await createCredito({
    fecha, user_id: cliente.id, articulos: 'Un perfume', deuda_inicial: 100000, fecha_limite,
  });
  return prisma.credito.findUniqueOrThrow({ where: { id: row.id } });
};

describe('el acuerdo de pago por defecto', () => {
  beforeEach(limpiarBase);

  it('son 30 días desde la fecha del crédito', async () => {
    expect(dia((await credito('2026-08-23')).fecha_limite)).toBe('2026-09-22');
  });

  it('un crédito de fin de mes ya no se desborda', async () => {
    expect(dia((await credito('2026-01-31')).fecha_limite)).toBe('2026-03-02');
  });

  it('si el dueño pacta otra fecha, manda la suya', async () => {
    expect(dia((await credito('2026-08-23', '2026-12-01')).fecha_limite)).toBe('2026-12-01');
  });
});
