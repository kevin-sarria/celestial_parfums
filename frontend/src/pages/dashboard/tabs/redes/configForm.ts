import type { ContactoForma } from '../../../../domain/entities/contacto.schema';

/**
 * Lo que se teclea en la configuración de la página Contáctame: el perfil, el
 * fondo, la forma de los botones y dónde se coloca cada mitad.
 *
 * Vive aparte de la pestaña por la misma razón que `LinkForm` vive con su
 * modal: es la forma del formulario, no la pantalla.
 */
export interface ConfigForm {
  avatar_url: string;
  nombre: string;
  descripcion: string;
  fondo_tipo: 'color' | 'imagen';
  fondo_color: string;
  fondo_imagen: string;
  boton_forma: ContactoForma;
  boton_color_fondo: string;
  boton_color_texto: string;
  contenido_posicion: 'arriba' | 'centro';
  redes_posicion: 'centro' | 'abajo';
}

export const emptyConfigForm = (): ConfigForm => ({
  avatar_url: '', nombre: 'Celestial Parfums', descripcion: '',
  fondo_tipo: 'color', fondo_color: '#f6f3ec', fondo_imagen: '',
  boton_forma: 'redondo', boton_color_fondo: '#ffffff', boton_color_texto: '#2f2a3d',
  contenido_posicion: 'centro', redes_posicion: 'centro',
});
