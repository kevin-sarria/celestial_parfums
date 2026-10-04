/**
 * Lo que se pierde al trasvasar un perfume ORIGINAL a un decant.
 *
 * Al pasar de la botella al frasquito siempre queda producto en la jeringa, el
 * embudo y las paredes. El dueño lo calculó en "1 a 2 ml" por decant
 * (2026-09-28); se toma el tope a propósito: con el mínimo, la tienda podría
 * ofrecer un decant que la botella ya no alcanza a llenar, y el costo saldría
 * más barato de lo real.
 *
 * Vive aquí, en UN sitio, porque lo usan varias reglas que tienen que decir lo
 * mismo: lo que descuenta la venta (`inventario.consumoVenta.ts`), cuándo una
 * talla se da por agotada (`perfume.mapeo.ts`) y el costo que ve el dueño al
 * ponerle precio (`TallasDelPerfume.tsx`, que copia esta misma cuenta).
 */
export const MERMA_TRASVASE_ML = 2;

/**
 * Los tamaños de decant con los que nace un original (dueño, 2026-09-29).
 * Son el punto de partida de la ficha, no un candado: en ella se quitan o se
 * agregan tallas como en cualquier otro perfume.
 */
export const TALLAS_DECANT_ML = [3, 5, 10] as const;

/**
 * ¿Esta talla es la botella entera? Se vende tal cual llegó, sin trasvasar.
 * `mlBotella` null = no se sabe cuánto trae la botella, y entonces todo se
 * trata como decant (lo prudente: cuenta la pérdida).
 */
export const esBotellaCompleta = (ml: number, mlBotella: number | null | undefined) =>
  mlBotella != null && mlBotella > 0 && ml >= mlBotella;

/**
 * Lo que sale de la botella por UNA venta de `ml`.
 *
 * Un decant se lleva su contenido más lo que se pierde al trasvasar. La botella
 * completa, no: sale cerrada, así que descuenta exactamente lo que trae
 * (dueño, 2026-09-29). Cobrarle la pérdida la dejaría "agotada" con la botella
 * en la mano: 100 ml en bodega nunca alcanzarían para 102.
 */
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
