/**
 * La fila de botones de una pantalla o de una tabla (Exportar, Importar, + Nuevo…).
 *
 * Por convención el botón PRINCIPAL va de último: en el computador queda a la
 * derecha, que es donde se busca. En el celular eso lo mandaba al fondo de dos
 * filas de botones, detrás de los de mantenimiento — "+ Registrar venta" quedaba
 * después de Exportar, Enlazar e Importar (2026-10-02, skill
 * `dashboard-interno-ux`, defecto 14). Debajo de `sm` el último pasa al frente
 * y ocupa el ancho entero: es lo que se toca 40 veces al día.
 *
 * La comparten `ToolbarActions` y la barra de `SmartTable`, para que las dos
 * barras del panel se comporten igual.
 */
export const BARRA_ACCIONES =
  'flex flex-wrap items-center gap-2 max-sm:[&>*:last-child]:order-first max-sm:[&>*:last-child]:w-full';
