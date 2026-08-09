const RECORDATORIO_KEY = 'celestial_carrito_recordado';

/**
 * Recordatorio "Tu pedido te espera": se le muestra UNA vez por sesión a quien
 * VUELVE con productos en el carrito.
 *
 * La marca vive en `sessionStorage` y no en React porque la escriben dos sitios
 * que no se conocen: el globo que la consume (`CartFab`) y el carrito cuando el
 * cliente agrega algo (`CartProvider`). A quien acaba de agregar un producto no
 * hay nada que recordarle — ya sabe que su pedido existe, se lo acabamos de
 * confirmar con el aviso de "agregado al carrito".
 *
 * Antes esto funcionaba de casualidad: agregar abría el panel del carrito y eso
 * cancelaba el recordatorio. Desde que agregar ya no lo abre, hay que apagarlo
 * a propósito.
 */
export const recordatorioPendiente = () => !sessionStorage.getItem(RECORDATORIO_KEY);

/** Lo da por gastado en esta sesión: ya se mostró, o ya no hace falta. */
export const cerrarRecordatorio = () => sessionStorage.setItem(RECORDATORIO_KEY, '1');
