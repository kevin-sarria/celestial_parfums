import { Prisma } from '@prisma/client';

/**
 * LAS DOS FAMILIAS DEL DASHBOARD, y la misma pregunta aplicada a una ficha
 * que se está creando.
 *
 * Vive en su propio archivo (y no dentro de `perfume.repository.ts`) porque
 * ese archivo ya está en ~500 líneas: agregarle más lo habría roto la misma
 * regla que esto ayuda a mantener en otros archivos del proyecto.
 */

/**
 * Una sola pregunta decide de qué lado cae cada ficha: ¿existe ANTES de que lo
 * vendas, o se fabrica en el momento de venderlo? Es una regla que el sistema
 * evalúa solo, no una lista que el dueño mantenga a mano — el día que se marque
 * un producto mal, la lista no avisa; la regla sí.
 *
 * Ojo: el 212 VIP Black con frascos armados NO es "productos". Es un fabricado
 * que casualmente tiene stock, y se queda en Perfumes. Se descartó a propósito
 * el criterio "lo que tenga unidades hoy": un producto que entra y sale de una
 * pantalla según el stock es de lo que más confunde con el tiempo.
 */
export type FamiliaProducto = 'fabricadas' | 'productos';

const ES_PRODUCTO: Prisma.PerfumeWhereInput = {
  OR: [{ solo_armado: true }, { tipo_producto: 'comprado' }],
};

export const WHERE_FAMILIA: Record<FamiliaProducto, Prisma.PerfumeWhereInput> = {
  productos: ES_PRODUCTO,
  // Perfumes es el COMPLEMENTO EXACTO, no una segunda lista: dos listas paralelas
  // se desincronizan el día que el enum crezca, y lo que caiga en el hueco
  // desaparece de las dos pestañas sin avisar. Pasó en la primera versión con
  // `fraccionado`. Un decant va aquí porque no existe antes de venderse: se corta
  // de la botella grande en el momento de la venta (ver inventario.consumoVenta.ts).
  fabricadas: { NOT: ES_PRODUCTO },
};

export const esFamilia = (v: string): v is FamiliaProducto =>
  Object.prototype.hasOwnProperty.call(WHERE_FAMILIA, v);

/** La misma pregunta que WHERE_FAMILIA, aplicada a una ficha que se está creando. */
export const naceComoProducto = (d: { solo_armado?: boolean; tipo_producto?: string }) =>
  (d.solo_armado ?? false) || d.tipo_producto === 'comprado';
