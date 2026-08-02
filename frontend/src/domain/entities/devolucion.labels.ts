import type { DevolucionEstado, DevolucionMotivo, DevolucionSolucion } from '../../pages/dashboard/types';

/**
 * Textos y colores del módulo de devoluciones, en un solo sitio: los usan la
 * tabla, el formulario y (más adelante) el portal del cliente.
 */

export const MOTIVOS: { v: DevolucionMotivo; label: string }[] = [
  { v: 'llego_danado', label: 'Llegó dañado o derramado' },
  { v: 'llego_equivocado', label: 'Llegó un producto equivocado' },
  { v: 'llego_incompleto', label: 'Llegó incompleto' },
  { v: 'envase_defectuoso', label: 'Envase o atomizador defectuoso' },
  { v: 'no_llego', label: 'Nunca llegó' },
  { v: 'otro', label: 'Otro motivo' },
];

export const ESTADOS: { v: DevolucionEstado; label: string; clase: string }[] = [
  { v: 'pendiente', label: 'Pendiente', clase: 'border-amber-300 bg-amber-50 text-amber-700' },
  { v: 'en_revision', label: 'En revisión', clase: 'border-sky-300 bg-sky-50 text-sky-700' },
  { v: 'resuelta', label: 'Resuelta', clase: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  { v: 'rechazada', label: 'Rechazada', clase: 'border-rose-300 bg-rose-50 text-rose-700' },
];

export const SOLUCIONES: { v: DevolucionSolucion; label: string }[] = [
  { v: 'reposicion', label: 'Le repuse el producto' },
  { v: 'devolucion_dinero', label: 'Le devolví el dinero' },
  { v: 'ninguna', label: 'No procedía (se aclaró con el cliente)' },
];

export const etiquetaMotivo = (v: DevolucionMotivo) =>
  MOTIVOS.find((m) => m.v === v)?.label ?? v;

export const etiquetaSolucion = (v: DevolucionSolucion | null) =>
  (v ? SOLUCIONES.find((s) => s.v === v)?.label ?? v : null);

/**
 * La misma solución contada AL CLIENTE. Las de arriba están escritas en voz del
 * admin ("Le repuse el producto") y en el portal sonarían como si el cliente se
 * lo hubiera hecho a sí mismo.
 */
const SOLUCIONES_CLIENTE: Record<DevolucionSolucion, string> = {
  reposicion: 'Te repusimos el producto',
  devolucion_dinero: 'Te devolvimos el dinero',
  ninguna: 'Revisamos tu caso y no correspondía la garantía',
};

export const etiquetaSolucionCliente = (v: DevolucionSolucion | null) =>
  (v ? SOLUCIONES_CLIENTE[v] : null);

export const metaEstado = (v: DevolucionEstado) =>
  ESTADOS.find((e) => e.v === v) ?? ESTADOS[0];

/** Plazo legal para hacer efectiva la garantía (Decreto 735 de 2013). */
export const PLAZO_LEGAL_HABILES = 30;

/**
 * Días HÁBILES transcurridos desde que el cliente reportó. Se cuentan hábiles
 * porque así los cuenta la ley; contar corridos daría una alarma prematura.
 */
export const diasHabilesDesde = (desde: string): number => {
  const [a, m, d] = desde.split('-').map(Number);
  const ini = new Date(a, m - 1, d);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let dias = 0;
  const cursor = new Date(ini);
  while (cursor < hoy) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
};
