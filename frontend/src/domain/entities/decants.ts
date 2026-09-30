/**
 * La cuenta de un decant, del lado del navegador.
 *
 * COPIA de `backend/src/utils/decants.ts`, que es quien manda: allá se descuenta
 * el inventario y se decide si una talla está agotada. Aquí solo se usa para
 * mostrarle al dueño cuánto le cuesta cada talla mientras le pone precio. Si
 * cambia la pérdida por trasvase, se cambia en los dos sitios.
 */
export const MERMA_TRASVASE_ML = 2;

export const esBotellaCompleta = (ml: number, mlBotella: number | null | undefined) =>
  mlBotella != null && mlBotella > 0 && ml >= mlBotella;

export const mlQueSalenDeLaBotella = (ml: number, mlBotella?: number | null) =>
  esBotellaCompleta(ml, mlBotella) ? ml : ml + MERMA_TRASVASE_ML;
