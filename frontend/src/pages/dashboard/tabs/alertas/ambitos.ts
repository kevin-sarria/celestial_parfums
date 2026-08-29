/**
 * LAS TRES FAMILIAS DE MATERIAL, dichas como las dice el dueño.
 *
 * Viven aquí y no dentro de la pantalla porque las usan dos: la de configurar
 * las alertas y el aviso que sale en el dashboard. Y sobre todo, porque
 * **"esencias" no significa "materia prima"**: significa materia prima CON gama,
 * y eso hay que explicarlo en pantalla o el dueño esperará ver ahí el diluyente.
 */

export type Ambito = 'esencias' | 'envases' | 'implementos';

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
  materiales: { id: number; nombre: string; stock: number; unidad: string }[];
}

export const FILAS_ALERTA: {
  ambito: Ambito; titulo: string; unidad: string; explicacion: string;
}[] = [
  {
    ambito: 'esencias',
    titulo: 'Esencias',
    unidad: 'ml',
    explicacion: 'Solo las esencias con gama. El diluyente, el sellador y las feromonas NO entran '
      + 'aquí: se compran por litros y medirlos con esta vara llenaría la alerta de ruido. '
      + 'Si quieres avisos de ellos, ponles su mínimo propio en Inventario.',
  },
  {
    ambito: 'envases',
    titulo: 'Envases',
    unidad: 'unidades',
    explicacion: 'Frascos y botellas de todas las tallas.',
  },
  {
    ambito: 'implementos',
    titulo: 'Implementos',
    unidad: 'unidades',
    explicacion: 'Perfumeros, bolsas, tarjetas y todo lo que acompaña al pedido.',
  },
];

export const ETIQUETA_AMBITO: Record<Ambito, string> = {
  esencias: 'Esencias',
  envases: 'Envases',
  implementos: 'Implementos',
};
