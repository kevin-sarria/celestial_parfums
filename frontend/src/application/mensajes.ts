import { formatPrice } from '@/lib/format';
import { leerFecha } from '../utils/calendario';

/**
 * EL MAESTRO DE MENSAJES: los textos de WhatsApp que el dueño escribe, y las
 * marcas que el panel les rellena.
 *
 * Existe porque el tono lo pone él: escribe *"ey bro, como vamos"* a un cliente
 * joven y algo formal a uno mayor, así que guarda VARIAS variantes por caso y
 * elige al mandar. Antes estos textos vivían dentro del código y cambiar una
 * coma era un despliegue.
 *
 * Nada de esto inventa texto: la pantalla nace vacía y él la llena.
 */

/**
 * Los casos en los que el panel manda un WhatsApp. Es el espejo de
 * `CASOS_MENSAJE` del backend: uno nuevo se agrega en los dos sitios.
 */
export const CASOS_MENSAJE = [
  {
    id: 'credito',
    label: 'Recordar el pago',
    ayuda: 'Se manda desde el botón «Recordar el pago» de cada crédito con saldo.',
  },
] as const;

export type CasoMensaje = (typeof CASOS_MENSAJE)[number]['id'];

export interface PlantillaMensaje {
  id: number;
  caso: string;
  nombre: string;
  texto: string;
  orden: number;
}

/**
 * Las marcas que el panel reemplaza por el dato real.
 *
 * En el editor son BOTONES que las insertan donde esté el cursor: nadie tiene
 * que aprenderse la sintaxis ni acordarse de las llaves.
 */
export const MARCADORES = [
  { marca: '{nombre}', que: 'El primer nombre del cliente', ejemplo: 'Laura' },
  { marca: '{saldo}', que: 'Lo que todavía debe', ejemplo: '$ 137.000' },
  { marca: '{vence}', que: 'Cuánto falta, o cuánto pasó', ejemplo: 'vence en 5 días' },
  { marca: '{fecha}', que: 'La fecha pactada', ejemplo: '15/10/2026' },
] as const;

export interface DatosMensaje {
  nombre: string;
  saldo: string;
  vence: string;
  fecha: string;
}

/**
 * Cambia cada marca por su dato.
 *
 * Lo que no reconoce lo deja TAL CUAL —un `{nombe}` mal escrito se ve en la
 * vista previa y él lo corrige—: borrarlo en silencio mandaría al cliente un
 * mensaje al que le falta un dato sin que nadie se entere.
 *
 * Se reemplaza con `split`/`join` y no con `replace`: el saldo trae `$`, que en
 * el reemplazo de JavaScript significa "el grupo tal" y saldría mal.
 */
export const rellenar = (texto: string, datos: DatosMensaje): string =>
  Object.entries(datos).reduce((t, [clave, valor]) => t.split(`{${clave}}`).join(valor), texto);

/**
 * "vence en 5 días" · "venció hace 3 días" · "vence hoy" · "venció ayer".
 *
 * **Una sola frase sirve para los dos casos** —por vencer y ya vencido—, para
 * que al dueño le alcance UNA plantilla: *"te recuerdo que tu crédito {vence}"*
 * funciona antes y después de la fecha.
 */
export const fraseVence = (dias: number): string => {
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias > 1) return `vence en ${dias} días`;
  if (dias === -1) return 'venció ayer';
  return `venció hace ${Math.abs(dias)} días`;
};

/**
 * El backend manda las fechas de calendario como INSTANTE ISO
 * (`"2026-10-09T00:00:00.000Z"`), no como `"2026-10-09"`. Aquí se recortan al
 * día antes de leerlas —la misma regla que `fmtDate` en `dashboard/helpers.ts`—:
 * sin el recorte, `leerFecha` no las reconoce y el mensaje le dice "sigue
 * pendiente" a alguien que sí tiene plazo pactado.
 */
const soloDia = (s: string | null | undefined) => (s ?? '').slice(0, 10);

/**
 * Los días que faltan para una fecha de calendario (negativo = ya pasó).
 *
 * Con `Date.UTC` y no con `new Date('2026-10-15')`: esa forma se interpreta como
 * medianoche UTC y en Colombia (UTC-5) devuelve el día anterior, que es el
 * tropiezo de siempre (ver CLAUDE.md).
 */
export const diasHasta = (fecha: string | null | undefined, hoy: string): number | null => {
  const destino = leerFecha(soloDia(fecha));
  const base = leerFecha(soloDia(hoy));
  if (!destino || !base) return null;
  const ms = Date.UTC(destino.anio, destino.mes - 1, destino.dia)
    - Date.UTC(base.anio, base.mes - 1, base.dia);
  return Math.round(ms / 86_400_000);
};

/** '2026-10-15' → "15/10/2026". Sin `Date`: una fecha de calendario no tiene zona. */
const fechaCorta = (s: string | null) => {
  const f = leerFecha(soloDia(s));
  return f
    ? `${String(f.dia).padStart(2, '0')}/${String(f.mes).padStart(2, '0')}/${f.anio}`
    : 'sin fecha pactada';
};

export interface CreditoParaMensaje {
  cliente: { nombre: string };
  total_en_deuda: number;
  fecha_limite: string | null;
}

/** Los datos de un crédito, listos para rellenar una plantilla. */
export const datosDeCredito = (c: CreditoParaMensaje, hoy: string): DatosMensaje => {
  const dias = diasHasta(c.fecha_limite, hoy);
  return {
    // Solo el primer nombre: "Hola Laura" suena a conocido, "Hola Laura Gómez" a cobrador.
    nombre: c.cliente.nombre.trim().split(/\s+/)[0] ?? '',
    saldo: formatPrice(c.total_en_deuda),
    vence: dias == null ? 'sigue pendiente' : fraseVence(dias),
    fecha: fechaCorta(c.fecha_limite),
  };
};

/**
 * Un cliente de mentira para la vista previa.
 *
 * El saldo sale del MISMO formateador que los de verdad (`formatPrice`): si se
 * escribiera a mano, la vista previa mostraría un espacio normal donde el
 * mensaje real lleva uno duro, y el ejemplo no sería el ejemplo.
 */
export const EJEMPLO: DatosMensaje = {
  nombre: 'Laura',
  saldo: formatPrice(137000),
  vence: 'vence en 5 días',
  fecha: '15/10/2026',
};
