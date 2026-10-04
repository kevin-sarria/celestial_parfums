/**
 * LAS TRES FAMILIAS DE MATERIAL, dichas como las dice el dueño.
 *
 * Viven aquí y no dentro de la pantalla porque las usan dos: la de configurar
 * las alertas y el aviso que sale en el dashboard. Y sobre todo, porque
 * **"esencias" no significa "materia prima"**: significa materia prima CON gama,
 * y eso hay que explicarlo en pantalla o el dueño esperará ver ahí el diluyente.
 */

export type Ambito = 'esencias' | 'envases' | 'frascos_fragancia' | 'implementos';

export interface Alerta {
  id: number;
  ambito: Ambito;
  minimo: number;
  forma: 'franja' | 'ventana';
  titulo: string | null;
  mensaje: string | null;
  activo: boolean;
  orden: number;
}

export interface AlertaDisparada {
  ambito: Ambito;
  forma: 'franja' | 'ventana';
  minimo: number;
  titulo: string;
  mensaje: string | null;
  /** `dias_alcanza`: para cuántos días alcanza (null = no se gasta). */
  materiales: { id: number; nombre: string; stock: number; unidad: string; dias_alcanza: number | null }[];
}

export const FILAS_ALERTA: {
  ambito: Ambito; titulo: string; unidad: string; explicacion: string;
}[] = [
  {
    ambito: 'esencias',
    titulo: 'Esencias',
    unidad: 'ml',
    explicacion: 'Solo las que tienen gama. El diluyente, el sellador y las feromonas no entran '
      + 'aquí: ponles su mínimo propio en Inventario.',
  },
  {
    ambito: 'envases',
    titulo: 'Envases',
    unidad: 'unidades',
    explicacion: 'Los genéricos: los que usa la receta de cada tamaño (30 ml, 100 ml…).',
  },
  {
    // Dueño, 2026-10-03: los de lujo de los 1.1 salen lento; no se piden de a 40
    ambito: 'frascos_fragancia',
    titulo: 'Frascos de una fragancia',
    unidad: 'unidades',
    explicacion: 'Los de los 1.1: asignados a un perfume en su ficha. Salen lento, así que llevan su '
      + 'propio número. Sin número no se piden.',
  },
  {
    ambito: 'implementos',
    titulo: 'Implementos',
    unidad: 'unidades',
    explicacion: 'Perfumeros, bolsas, tarjetas y lo que acompaña al pedido.',
  },
];

export const ETIQUETA_AMBITO: Record<Ambito, string> = {
  esencias: 'Esencias',
  envases: 'Envases',
  frascos_fragancia: 'Frascos de fragancia',
  implementos: 'Implementos',
};
