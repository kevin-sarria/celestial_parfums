/**
 * Lo que se pierde al trasvasar un perfume ORIGINAL a un decant.
 *
 * Al pasar de la botella al frasquito siempre queda producto en la jeringa, el
 * embudo y las paredes. El dueño lo calculó en "1 a 2 ml" por decant
 * (2026-09-28); se toma el tope a propósito: con el mínimo, la tienda podría
 * ofrecer un decant que la botella ya no alcanza a llenar, y el costo saldría
 * más barato de lo real.
 *
 * Vive aquí, en UN sitio, porque lo usan dos reglas que tienen que decir lo
 * mismo: lo que descuenta la venta (`inventario.consumoVenta.ts`) y cuándo un
 * decant se da por agotado (`perfume.mapeo.ts`).
 */
export const MERMA_TRASVASE_ML = 2;

/** Lo que sale de la botella por UN decant de `ml`: su contenido más lo que se pierde. */
export const mlPorDecant = (ml: number) => ml + MERMA_TRASVASE_ML;
