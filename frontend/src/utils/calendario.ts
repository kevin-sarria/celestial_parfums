/**
 * La aritmética del selector de fecha (`CampoFecha`), sin pantalla.
 *
 * Todo se hace con fechas de CALENDARIO ('AAAA-MM-DD') y `Date.UTC`: nunca con
 * la hora local. En Colombia (UTC-5) una fecha construida con hora local y
 * leída en UTC se corre al día anterior —el mismo tropiezo que ya costó varias
 * veces con `toISOString()`, ver CLAUDE.md—.
 */

export interface Dia { anio: number; mes: number; dia: number }

const dos = (n: number) => String(n).padStart(2, '0');

export const aTexto = ({ anio, mes, dia }: Dia) => `${anio}-${dos(mes)}-${dos(dia)}`;

/** 'AAAA-MM-DD' → día, o null si no es una fecha válida. */
export const leerFecha = (s: string | undefined | null): Dia | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  // "2026-02-31" existe como texto pero no como día: Date lo pasaría a marzo
  if (d.getUTCMonth() !== mes - 1) return null;
  return { anio, mes, dia };
};

/** Suma días (negativos restan) y devuelve 'AAAA-MM-DD'. */
export const moverDias = (s: string, dias: number) => {
  const f = leerFecha(s);
  if (!f) return s;
  const d = new Date(Date.UTC(f.anio, f.mes - 1, f.dia + dias));
  return aTexto({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() });
};

/**
 * Suma meses conservando el día cuando existe: del 31 de enero, un mes
 * adelante es el 28 (o 29) de febrero, no el 3 de marzo.
 */
export const moverMeses = (s: string, meses: number) => {
  const f = leerFecha(s);
  if (!f) return s;
  const primero = new Date(Date.UTC(f.anio, f.mes - 1 + meses, 1));
  const anio = primero.getUTCFullYear();
  const mes = primero.getUTCMonth() + 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return aTexto({ anio, mes, dia: Math.min(f.dia, ultimo) });
};

/**
 * Las 6 semanas que pinta el calendario de un mes, de LUNES a domingo (así se
 * cuenta la semana en Colombia). Incluye los días de los meses vecinos para
 * que la cuadrícula tenga siempre el mismo alto y el panel no salte.
 */
export const semanasDelMes = (anio: number, mes: number) => {
  const primero = new Date(Date.UTC(anio, mes - 1, 1));
  // getUTCDay: 0 = domingo. Días que hay que retroceder hasta el lunes.
  const atras = (primero.getUTCDay() + 6) % 7;
  const inicio = aTexto({ anio, mes, dia: 1 });
  const dias = Array.from({ length: 42 }, (_, i) => moverDias(inicio, i - atras));
  return Array.from({ length: 6 }, (_, s) => dias.slice(s * 7, s * 7 + 7));
};

/** ¿Cabe dentro de [min, max]? Las fechas 'AAAA-MM-DD' se comparan como texto. */
export const dentroDe = (s: string, min?: string, max?: string) =>
  (!min || s >= min) && (!max || s <= max);

/**
 * Los nombres van escritos aquí y no con `Intl`: en es-CO `Intl` da
 * "28 de sept de 2026", largo para un campo de celular, y cambia según el
 * navegador ("sept" en unos, "sep" en otros).
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2026-09-28' → "28 sep 2026". Sin pasar por `Date`: no hay zona horaria que lo corra. */
export const fechaLegible = (s: string) => {
  const f = leerFecha(s);
  return f ? `${f.dia} ${MESES[f.mes - 1].slice(0, 3)} ${f.anio}` : '';
};

/** 2026, 9 → "Septiembre 2026" (solo la primera letra en mayúscula). */
export const mesLegible = (anio: number, mes: number) => {
  const nombre = MESES[mes - 1];
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${anio}`;
};

/**
 * El DÍA y la HORA de Colombia de un instante (una fecha ISO del servidor).
 *
 * Con el desfase fijo de −5 h (Colombia no tiene horario de verano) y no con la
 * hora del teléfono: un cliente que mira su historial desde el exterior tiene
 * que ver la hora a la que pagó aquí, no la de su país.
 */
const enColombia = (iso: string) => new Date(new Date(iso).getTime() - 5 * 3600_000);

/** '2026-09-22T01:27:00Z' → '2026-09-21'. */
export const diaEnColombia = (iso: string) => {
  const d = enColombia(iso);
  return aTexto({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() });
};

/** '2026-09-22T01:27:00Z' → "8:27 p. m." (escrita a mano: `Intl` varía según el navegador). */
export const horaEnColombia = (iso: string) => {
  const d = enColombia(iso);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${dos(d.getUTCMinutes())} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};
