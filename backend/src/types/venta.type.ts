import type { CreateVentaInput } from '../schemas/venta.schema';

/**
 * Lo que se necesita para crear o editar una venta.
 *
 * NO se escribe aquí: es exactamente lo que el esquema de Zod deja pasar. Antes
 * era una copia a mano y se había quedado atrás —no declaraba `lineas`, que es
 * por donde entran hoy los productos y los regalos—, así que las pruebas y el
 * controlador tenían que taparlo con un `as any`. Una regla en un solo sitio.
 */
export type CreateVentaDTO = CreateVentaInput;
