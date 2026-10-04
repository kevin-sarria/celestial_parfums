import { prisma } from '../config/prisma';
import { minimoDe, minimosPorAmbito, SELECT_FAMILIA } from './alertas.repository';
import { consumoDiarioPorInsumo, DIAS_HISTORIAL, diasQueAlcanza, llegoAlAviso } from './consumo';

/**
 * Pedido sugerido: qué material hay que reponer y cuánto pedir.
 *
 * Es una pantalla **solo informativa** — no mueve stock ni registra nada. Sale
 * de tres datos que ya existen: lo que hay, el punto de pedido y lo que se ha
 * consumido de verdad.
 *
 * El punto de pedido se configura **por gama** (una vez para las 151 árabes) y
 * cada esencia puede tener su excepción. Sin eso la alerta era inservible en la
 * práctica: se midió y solo 1 de 226 materiales tenía mínimo puesto, porque
 * ponerlo a mano en 219 esencias no lo hace nadie.
 *
 * Desde el 2026-08-29 la cascada tiene un tercer escalón —el mínimo de la
 * FAMILIA (`alertas.repository.ts`)— y los materiales marcados **en prueba** se
 * quedan fuera: el dueño trajo 30 ml de una esencia nueva para ver si sale y la
 * lista se la pedía sin que hubiera vendido una sola unidad.
 */

const num = (v: unknown) => Number(v);
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Para cuántos días de venta se pide, cuando hay consumo con el que calcular. */
const DIAS_COBERTURA = 60;

export interface FilaReposicion {
  id: number;
  nombre: string;
  tipo: string;
  unidad: string;
  gama: string | null;
  stock: number;
  minimo: number;
  /** true = el mínimo lo pone su gama, no es propio. */
  minimo_heredado: boolean;
  /** Cuánto se ha consumido al día, en promedio, en los últimos 90 días. */
  consumo_diario: number;
  /** Para cuántos días alcanza lo que hay; null = no se gasta. */
  dias_alcanza: number | null;
  /** Cuánto pedir. */
  sugerido: number;
  /** De dónde sale el sugerido, para poder explicarlo en pantalla. */
  base: 'consumo' | 'minimo';
  costo_promedio: number;
  /** Lo que costaría reponerlo al costo promedio de hoy. */
  costo_estimado: number;
}

export interface Reposicion {
  esencias: FilaReposicion[];
  implementos: FilaReposicion[];
  /**
   * Los materiales que se dejaron fuera por estar EN PRUEBA.
   *
   * Va la LISTA y no un conteo porque desde aquí se desmarcan: un número suelto
   * obligaría a ir a buscarlos a otra pantalla, y una decisión temporal que
   * cuesta deshacer se vuelve permanente sola.
   */
  en_prueba: { id: number; nombre: string }[];
  /** true = todavía no hay salidas registradas con las que estimar consumo. */
  sin_historial: boolean;
  dias_historial: number;
  dias_cobertura: number;
  costo_total: number;
}

export const calcularReposicion = async (): Promise<Reposicion> => {
  const [insumos, consumoPorInsumo, porAmbito] = await Promise.all([
    prisma.insumoCosto.findMany({
      where: { activo: true },
      // Los usos como frasco deciden si un envase es genérico o de una fragancia
      include: { gama: true, envase_de: SELECT_FAMILIA.envase_de, envase_de_talla: SELECT_FAMILIA.envase_de_talla },
      orderBy: [{ tipo: 'asc' }, { nombre: 'asc' }],
    }),
    consumoDiarioPorInsumo(),
    minimosPorAmbito(),
  ]);

  const filas: FilaReposicion[] = [];
  const enPrueba: { id: number; nombre: string }[] = [];
  for (const i of insumos) {
    /**
     * En prueba = "todavía no me interesa reponerlo".
     *
     * No se esconde en silencio: se cuenta y la pantalla dice cuántos hay, para
     * que una decisión temporal no se vuelva un olvido permanente.
     */
    if (i.en_prueba) { enPrueba.push({ id: i.id, nombre: i.nombre }); continue; }

    const stock = num(i.stock);
    // Su mínimo → el de su gama → el de su familia. La cascada vive en un solo
    // sitio porque este número lo miran dos pantallas y tienen que coincidir.
    const { minimo, propio } = minimoDe(i, porAmbito);
    const consumoDiario = consumoPorInsumo.get(i.id) ?? 0;

    // Entra si bajó de su mínimo O si lo que hay alcanza para menos de 2
    // semanas de lo que se gasta (opción C del dueño, 2026-10-04): manda el
    // que llegue primero. Sin mínimo ni consumo no se avisa: avisar de todo es
    // lo mismo que no avisar de nada.
    if (!llegoAlAviso({ stock, minimo, consumoDiario })) continue;

    /**
     * Cuánto pedir. Con consumo medido se pide para cubrir los próximos
     * DIAS_COBERTURA días; sin él, se vuelve al doble del mínimo, que es el
     * colchón que ya usaba la lista de compras de Inventario.
     */
    const porConsumo = consumoDiario > 0
      ? r3(consumoDiario * DIAS_COBERTURA - stock)
      : 0;
    const porMinimo = r3(minimo * 2 - stock);
    const sugerido = Math.max(0, porConsumo > porMinimo ? porConsumo : porMinimo);
    const precio = num(i.precio);

    filas.push({
      id: i.id,
      nombre: i.nombre,
      tipo: i.tipo,
      unidad: i.unidad,
      gama: i.gama?.nombre ?? null,
      stock,
      minimo,
      minimo_heredado: !propio,
      consumo_diario: consumoDiario,
      dias_alcanza: diasQueAlcanza(stock, consumoDiario),
      sugerido,
      base: porConsumo > porMinimo ? 'consumo' : 'minimo',
      costo_promedio: precio,
      costo_estimado: Math.round(sugerido * precio),
    });
  }

  // Las esencias van aparte de todo lo demás: se piden a otro proveedor y se
  // deciden con otra cabeza (la gama manda), así que mezclarlas estorba.
  const esencias = filas.filter((f) => f.gama != null);
  const implementos = filas.filter((f) => f.gama == null);

  return {
    esencias,
    implementos,
    en_prueba: enPrueba,
    sin_historial: consumoPorInsumo.size === 0,
    dias_historial: DIAS_HISTORIAL,
    dias_cobertura: DIAS_COBERTURA,
    costo_total: filas.reduce((s, f) => s + f.costo_estimado, 0),
  };
};

/**
 * Cambia SOLO el punto de pedido de un material, sin tocar existencias.
 *
 * Hasta ahora el mínimo se ponía desde el modal de Ajustar, que es un conteo
 * físico y deja su movimiento. Corregir un mínimo no es contar: no debe
 * ensuciar el libro de inventario con un movimiento que no ocurrió.
 *
 * `null` lo devuelve a heredar el de su gama.
 */
export const fijarMinimoInsumo = (id: number, minimo: number | null) =>
  prisma.insumoCosto.update({
    where: { id },
    data: { stock_minimo: minimo },
    select: { id: true, nombre: true, stock_minimo: true },
  });

/** Punto de pedido por defecto de todas las esencias de una gama. */
export const fijarMinimoGama = (id: number, minimo: number) =>
  prisma.gamaEsencia.update({
    where: { id },
    data: { stock_minimo: minimo },
    select: { id: true, nombre: true, stock_minimo: true },
  });

/**
 * Guarda los puntos de pedido de varias gamas **y devuelve la lista ya
 * recalculada**.
 *
 * Las dos mitades van juntas por una razón de fondo: cambiar un mínimo no
 * cambia una casilla, **cambia la pantalla entera** — qué materiales están bajo
 * mínimo, cuánto pedir de cada uno y cuánto costará el pedido. Ese cálculo no
 * se puede rehacer en el navegador porque necesita el consumo de los últimos 90
 * días, que vive aquí.
 *
 * Devolviéndola en la misma respuesta, guardar cuesta **un solo viaje** en vez
 * de uno por gama más otro para volver a pedir la lista.
 *
 * Va en transacción: si una gama falla, no se guarda ninguna. Cuatro casillas
 * de un mismo formulario no pueden quedar a medio guardar.
 */
export const fijarMinimosGamas = async (minimos: { id: number; minimo: number }[]) => {
  await prisma.$transaction(
    minimos.map(({ id, minimo }) => prisma.gamaEsencia.update({
      where: { id },
      data: { stock_minimo: minimo },
    })),
  );
  return calcularReposicion();
};

/**
 * Marca un material como EN PRUEBA (o lo devuelve al pedido sugerido).
 *
 * Vive aquí y no en el alta del material porque es una decisión sobre la
 * REPOSICIÓN, no sobre el material: "todavía no me interesa reponerlo". El
 * material sigue entero — se vende, se produce y suma al valor del inventario.
 */
export const marcarEnPrueba = (id: number, en_prueba: boolean) =>
  prisma.insumoCosto.update({
    where: { id },
    data: { en_prueba },
    select: { id: true, nombre: true, en_prueba: true },
  });
