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

/**
 * ¿Esta talla puede caer al PRECIO GENERAL del perfume si no tiene uno propio
 * ni de la lista? En un original (`fraccionado`) el precio general es el de la
 * botella: solo la botella completa lo hereda. Un decant sin precio queda en 0
 * y la tienda lo esconde hasta que el dueño le ponga el suyo (opción B,
 * 2026-10-02). Antes lo heredaba: en vivo salían decants de 3 ml a $270.000
 * (2026-10-03). Sin saber cuánto trae la botella, ninguna talla lo hereda.
 */
export const heredaPrecioGeneral = (tipoProducto: string | null | undefined, ml: number | null | undefined, mlBotella: number | null | undefined) =>
  tipoProducto !== 'fraccionado' || (ml != null && esBotellaCompleta(ml, mlBotella));
