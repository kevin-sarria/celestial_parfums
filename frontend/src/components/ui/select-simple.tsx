import * as React from 'react';
import BuscadorSelect from '../BuscadorSelect';

/**
 * Desplegable de lista corta, escrito con `<option>` como un select de siempre.
 *
 * **Por dentro NO es un `<select>` del navegador: es el desplegable de la
 * aplicación** (`BuscadorSelect`). Decisión del dueño el 2026-08-13: *"verifica
 * todos los selects que se usen en la app y cámbialos al que hicimos para la
 * app, ninguno puede quedar con uno diferente"*. Un select nativo se ve bien
 * cerrado —lleva las clases del design system— pero al abrirlo despliega la
 * lista del SISTEMA OPERATIVO: tipografía, colores y bordes de Windows en medio
 * de una pantalla marfil e iris. Se notaba justo en el momento de usarlo.
 *
 * Mantiene la API del select para que los 58 sitios que ya existían no cambien
 * ni una línea: se le siguen pasando `<option>` como hijos y un `onChange` que
 * recibe `e.target.value`. Cambiar 26 archivos a mano habría sido mucho más
 * arriesgado que envolverlo aquí.
 *
 * El buscador **aparece solo a partir de 6 opciones** (ver `conBuscador`), así
 * que un desplegable de tres cosas no gana una caja de búsqueda inútil: se
 * conserva el criterio anterior del proyecto, pero con un solo aspecto.
 */

interface OpcionPlana {
  valor: string;
  etiqueta: string;
}

/** Saca las `<option>` de los hijos, incluidas las que vienen de un `.map()`. */
const leerOpciones = (children: React.ReactNode): OpcionPlana[] => {
  const salida: OpcionPlana[] = [];
  React.Children.forEach(children, (hijo) => {
    if (!React.isValidElement(hijo)) return;
    if (hijo.type === React.Fragment) {
      salida.push(...leerOpciones((hijo.props as { children?: React.ReactNode }).children));
      return;
    }
    if (hijo.type !== 'option') return;
    const props = hijo.props as { value?: string | number; children?: React.ReactNode };
    const etiqueta = React.Children.toArray(props.children).join('');
    salida.push({ valor: String(props.value ?? etiqueta), etiqueta });
  });
  return salida;
};

type Props = Omit<React.ComponentProps<'select'>, 'onChange'> & {
  onChange?: (e: { target: { value: string } }) => void;
};

function SelectSimple({ className, children, value, onChange, disabled, id, ...props }: Props) {
  const opciones = React.useMemo(
    () => leerOpciones(children).map((o) => ({ id: o.valor, nombre: o.etiqueta })),
    [children],
  );

  return (
    <BuscadorSelect
      opciones={opciones}
      value={value == null ? '' : String(value)}
      disabled={disabled}
      className={className}
      id={id}
      aria-label={props['aria-label']}
      // Se rearma el evento que esperan los 53 manejadores que ya existen
      // (`e.target.value`). Es lo único de la API del select que usan: se
      // comprobó uno por uno antes de hacer el cambio.
      onSelect={(elegido) => onChange?.({ target: { value: String(elegido) } })}
    />
  );
}

export { SelectSimple };
