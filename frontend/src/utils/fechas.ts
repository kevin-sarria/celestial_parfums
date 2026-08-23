/**
 * Fechas de CALENDARIO ("el 22 de agosto"), que no son lo mismo que instantes.
 *
 * La regla del proyecto: nunca `toISOString()` sobre una fecha de calendario,
 * porque Colombia va en UTC-5 y eso corre el día. Aquí entra texto
 * 'AAAA-MM-DD' y sale texto: no se pasa por la hora local en ningún momento.
 *
 * El gemelo de este archivo vive en `backend/src/utils/fechas.ts`, y el
 * plazo del crédito está en los dos porque cada lado tiene que poder
 * calcularlo solo: el formulario lo propone mientras escribes y el servidor lo
 * decide al guardar. Si un día cambia, se cambia en los dos — y por eso el
 * número tiene nombre en vez de estar suelto en medio de una función.
 */

/**
 * El plazo por defecto de un crédito: **30 días de calendario**.
 *
 * Decidido por el dueño el 2026-08-23: contar "el mismo día del mes siguiente"
 * hace que un crédito de fin de enero venza el 28 de febrero y *parezca* menos
 * de un mes. Con 30 días el plazo es siempre el mismo, y "un mes" en un
 * acuerdo de palabra es aproximado.
 */
export const DIAS_PLAZO_CREDITO = 30;

/**
 * Qué día es HOY donde está el usuario, como 'AAAA-MM-DD'.
 *
 * Se lee con `getFullYear`/`getMonth`/`getDate` —la hora LOCAL— y nunca con
 * `toISOString()`, que devuelve el día en UTC. La diferencia no es teórica:
 * Colombia va en UTC-5, así que **desde las 7:00 p.m. `toISOString()` ya dice
 * mañana**. Con eso, una venta registrada a las 8 de la noche nacía fechada al
 * día siguiente, un lote de producción entraba al inventario con fecha futura,
 * y el crédito de esa venta contaba sus 30 días desde mañana.
 */
export const hoy = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

/** Suma días a una fecha 'AAAA-MM-DD' y devuelve otra igual. Todo en UTC. */
export const sumarDias = (fecha: string, dias: number): string => {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-').map(Number);
  const destino = new Date(Date.UTC(anio, mes - 1, dia) + dias * 86400000);
  const mm = String(destino.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(destino.getUTCDate()).padStart(2, '0');
  return `${destino.getUTCFullYear()}-${mm}-${dd}`;
};

/** La fecha límite que el formulario propone para un crédito de ese día. */
export const fechaLimitePorDefecto = (fecha: string) => sumarDias(fecha, DIAS_PLAZO_CREDITO);
