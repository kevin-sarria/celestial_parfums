/**
 * LAS CASILLAS DE UN ROL (2026-10-04, opción C del dueño: él arma los roles de
 * su personal marcando permisos).
 *
 * Esta lista es la ÚNICA fuente de qué se puede marcar: un permiso existe aquí
 * solo si el servidor de verdad lo revisa. Una casilla que nadie revisa
 * prometería un bloqueo que no existe (ver `roles-y-permisos` en la skill del
 * proyecto). Por eso los módulos que todavía son solo del dueño —inventario,
 * producción, compras, reportes, la página web, los ajustes— no tienen casillas:
 * llegarán en la segunda parte, cuando se revisen.
 *
 * Lo que NO tiene casilla lo puede hacer solo el dueño (rol 1).
 */
export interface Permiso {
  clave: string;
  grupo: string;
  etiqueta: string;
  /** Lo que conviene saber antes de marcarla. */
  ayuda?: string;
}

export const PERMISOS: readonly Permiso[] = [
  { clave: 'ventas.ver', grupo: 'Ventas', etiqueta: 'Ver las ventas' },
  { clave: 'ventas.registrar', grupo: 'Ventas', etiqueta: 'Registrar ventas',
    ayuda: 'Al precio que calcula la app. Si pide un descuento, la venta espera tu aprobación.' },
  { clave: 'ventas.editar', grupo: 'Ventas', etiqueta: 'Corregir ventas ya registradas' },
  { clave: 'ventas.borrar', grupo: 'Ventas', etiqueta: 'Borrar ventas',
    ayuda: 'Sin esta casilla puede PEDIR que se borre, y tú apruebas o rechazas.' },

  { clave: 'creditos.ver', grupo: 'Créditos', etiqueta: 'Ver los créditos y cuánto debe cada cliente' },
  { clave: 'creditos.registrar', grupo: 'Créditos', etiqueta: 'Registrar créditos',
    ayuda: 'Igual que las ventas: un descuento espera tu aprobación.' },
  { clave: 'creditos.abonar', grupo: 'Créditos', etiqueta: 'Anotar abonos' },
  { clave: 'creditos.borrar', grupo: 'Créditos', etiqueta: 'Borrar créditos y abonos',
    ayuda: 'Sin esta casilla puede pedir que se borre un crédito.' },

  { clave: 'descuentos.aplicar', grupo: 'Descuentos', etiqueta: 'Dar descuentos, regalos y cupones sin pedir permiso',
    ayuda: 'Sin esta casilla el precio no se puede cambiar a mano: todo descuento te llega para aprobar.' },

  { clave: 'clientes.ver', grupo: 'Clientes', etiqueta: 'Ver la lista de clientes con sus datos de contacto',
    ayuda: 'Para registrar ventas y créditos ve los nombres aunque no la tenga.' },

  { clave: 'catalogo.ver', grupo: 'Catálogo', etiqueta: 'Ver el catálogo completo, también lo que no está en la tienda' },

  { clave: 'costos.ver', grupo: 'Costos', etiqueta: 'Ver costos, márgenes y ganancias',
    ayuda: 'Sin esta casilla se le esconden en todas las pantallas. Es lo que más cuida tu negocio.' },
] as const;

const CLAVES = new Set(PERMISOS.map((p) => p.clave));
export const esPermiso = (clave: string) => CLAVES.has(clave);
