import type { CreateCreditoInput } from '../schemas/credito.schema';

/**
 * Lo que se necesita para crear o editar un crédito.
 *
 * NO se escribe aquí: es exactamente lo que el esquema de Zod deja pasar. Era
 * una copia a mano y ya se había quedado atrás una vez en las ventas (no
 * declaraba `lineas`), así que aquí se evita el mismo camino desde el principio.
 */
export type CreateCreditoDTO = CreateCreditoInput;

export interface AddAbonoDTO {
  monto: number;
}
