import type { AlertaAmbito, AlertaForma, InsumoCosto } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * ALERTAS DE INVENTARIO PARA EL ADMINISTRADOR.
 *
 * Una fila por familia de materiales, y su número hace **las dos cosas**: es el
 * punto de pedido de esa familia y el umbral del aviso del dashboard. En la
 * cabeza del dueño son el mismo número; guardarlo dos veces garantiza que un día
 * digan cosas distintas.
 *
 * Nace de que poner el mínimo material por material no lo hace nadie: se midió y
 * **1 de 226** lo tenía. Por eso el valor útil vive en la familia, igual que ya
 * vivía en la gama para las esencias.
 *
 * Diseño en `docs/superpowers/specs/2026-08-29-alertas-y-en-prueba-design.md`.
 */

export type Ambito = AlertaAmbito;

/**
 * A qué familia pertenece un material.
 *
 * **"esencias" NO es "materia prima"**, y es la decisión que más se nota:
 * significa materia prima **con gama**. El diluyente, el sellador y las
 * feromonas son materia prima sin gama y quedan fuera — se compran por litros, y
 * medirlos con la vara de una esencia llenaría la alerta de ruido el primer día
 * (decisión del dueño, 2026-08-29). Siguen pudiendo tener su mínimo propio.
 */
export const ambitoDeInsumo = (
  i: Pick<InsumoCosto, 'tipo' | 'gama_id'>,
): Ambito | null => {
  if (i.tipo === 'envase') return 'envases';
  if (i.tipo === 'accesorio') return 'implementos';
  return i.gama_id != null ? 'esencias' : null;
};

export const listarAlertas = async () => {
  const filas = await prisma.alertaInventario.findMany({ orderBy: [{ orden: 'asc' }, { id: 'asc' }] });
  return filas.map((a) => ({ ...a, minimo: Number(a.minimo) }));
};

export interface AlertaInput {
  ambito: Ambito;
  minimo: number;
  forma: AlertaForma;
  activo: boolean;
  titulo?: string | null;
  mensaje?: string | null;
  orden?: number;
}

/**
 * Crea o corrige la regla de una familia.
 *
 * Es un `upsert` por `ambito` y no un alta libre: dos reglas para "envases" con
 * números distintos no tienen respuesta correcta, y la pantalla tendría que
 * inventarse una. La base lo respalda con un índice único.
 */
export const guardarAlerta = async (data: AlertaInput) => {
  const campos = {
    minimo: data.minimo,
    forma: data.forma,
    activo: data.activo,
    titulo: data.titulo?.trim() || null,
    mensaje: data.mensaje?.trim() || null,
    orden: data.orden ?? 0,
  };
  const fila = await prisma.alertaInventario.upsert({
    where: { ambito: data.ambito },
    create: { ambito: data.ambito, ...campos },
    update: campos,
  });
  return { ...fila, minimo: Number(fila.minimo) };
};

export const borrarAlerta = (id: number) => prisma.alertaInventario.delete({ where: { id } });

/** Los mínimos por familia, listos para la cascada. Solo las alertas encendidas. */
export const minimosPorAmbito = async (): Promise<Map<Ambito, number>> => {
  const filas = await prisma.alertaInventario.findMany({ where: { activo: true } });
  return new Map(filas.map((a) => [a.ambito, Number(a.minimo)]));
};

/**
 * El punto de pedido de un material, en cascada: **el suyo → el de su gama → el
 * de su familia**.
 *
 * Una sola función porque este número lo miran dos pantallas (el pedido sugerido
 * y la alerta del dashboard) y tienen que decir lo mismo. `0` = sin mínimo, y
 * sin mínimo no se avisa: avisar de todo es lo mismo que no avisar de nada.
 */
export const minimoDe = (
  i: Pick<InsumoCosto, 'tipo' | 'gama_id' | 'stock_minimo'> & { gama?: { stock_minimo: unknown } | null },
  porAmbito: Map<Ambito, number>,
): { minimo: number; propio: boolean } => {
  if (i.stock_minimo != null) return { minimo: Number(i.stock_minimo), propio: true };

  const deGama = Number(i.gama?.stock_minimo ?? 0);
  if (deGama > 0) return { minimo: deGama, propio: false };

  const ambito = ambitoDeInsumo(i);
  return { minimo: ambito ? (porAmbito.get(ambito) ?? 0) : 0, propio: false };
};

export interface AlertaDisparada {
  ambito: Ambito;
  forma: AlertaForma;
  minimo: number;
  titulo: string;
  mensaje: string | null;
  materiales: { id: number; nombre: string; stock: number; unidad: string }[];
}

const TITULO: Record<Ambito, string> = {
  esencias: 'Esencias por debajo del mínimo',
  envases: 'Envases por debajo del mínimo',
  implementos: 'Implementos por debajo del mínimo',
};

/**
 * Qué alertas están saltando AHORA, con los materiales que las disparan.
 *
 * Se recalcula en cada consulta y no se guarda: un "está alertando" guardado
 * queda mintiendo en cuanto entra una compra. Es la misma regla que rige el
 * resto del sistema.
 *
 * Los materiales **en prueba no disparan nada**: el dueño ya dijo que no le
 * interesa reponerlos todavía, y una alerta que salta por algo que él decidió
 * ignorar es la forma más rápida de que deje de mirar las alertas.
 */
export const alertasDisparadas = async (): Promise<AlertaDisparada[]> => {
  const [alertas, insumos] = await Promise.all([
    prisma.alertaInventario.findMany({
      where: { activo: true }, orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    }),
    prisma.insumoCosto.findMany({
      where: { activo: true, en_prueba: false },
      select: {
        id: true, nombre: true, stock: true, unidad: true, tipo: true, gama_id: true,
        stock_minimo: true,
        // La gama viaja porque su mínimo va ANTES que el de la familia en la
        // cascada: sin ella, una esencia con gama configurada se mediría con la
        // vara equivocada y el aviso diría un número que no es el suyo.
        gama: { select: { stock_minimo: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  const porAmbito = new Map(alertas.map((a) => [a.ambito, Number(a.minimo)]));

  return alertas.flatMap((a) => {
    const minimoFamilia = Number(a.minimo);
    const materiales = insumos
      .filter((i) => ambitoDeInsumo(i) === a.ambito)
      // Se compara contra el mínimo EFECTIVO de cada material, no contra el de
      // la familia a secas: si una esencia tiene el suyo en 100, esa es su raya.
      .filter((i) => {
        const { minimo } = minimoDe(i, porAmbito);
        return minimo > 0 && Number(i.stock) <= minimo;
      })
      .map((i) => ({ id: i.id, nombre: i.nombre, stock: Number(i.stock), unidad: i.unidad }));

    if (!materiales.length) return [];
    return [{
      ambito: a.ambito,
      forma: a.forma,
      minimo: minimoFamilia,
      titulo: a.titulo?.trim() || TITULO[a.ambito],
      mensaje: a.mensaje?.trim() || null,
      materiales,
    }];
  });
};
