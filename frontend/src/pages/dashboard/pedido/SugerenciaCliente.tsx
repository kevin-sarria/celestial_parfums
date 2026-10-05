import { Link2, UserPlus } from 'lucide-react';
import type { Usuario } from '../types';
import { personaLabel } from '../helpers';
import { buscarClientePorNombre, MIN_LETRAS, partirNombre } from './clienteDeTexto';

interface Props {
  /** Lo escrito en el campo "Persona" de la venta. */
  persona: string;
  /** Los clientes que ya existen (cuentas web y fichas sin cuenta). */
  usuarios: Usuario[];
  /** Ya hay un cliente elegido en el desplegable: no hay nada que ofrecer. */
  enlazado: boolean;
  onEnlazar: (id: number) => void;
  onGuardar: (nombre: string, apellido: string) => void;
}

/**
 * El puente entre el nombre que se escribe y la ficha del cliente.
 *
 * Nació de un número: **225 de 342 ventas estaban sin cliente** (2026-10-04), y
 * sin cliente no hay recompra, ni sellos, ni a quién escribirle. El formulario
 * siempre tuvo el desplegable "Cliente enlazado", pero es opcional y cuesta
 * abrirlo; esto quita ese paso —con el nombre ya escrito, un toque alcanza—.
 *
 * Es una SUGERENCIA, no un candado: el dueño puede ignorarla y guardar la venta
 * como siempre.
 */
export function SugerenciaCliente({ persona, usuarios, enlazado, onEnlazar, onGuardar }: Props) {
  if (enlazado) return null;
  const texto = persona.trim();
  if (texto.length < MIN_LETRAS) return null;

  const conocido = buscarClientePorNombre(usuarios, texto);
  const boton = 'font-medium text-primary underline underline-offset-2 hover:no-underline';

  if (conocido) {
    return (
      <p className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted-foreground">
        <Link2 className="size-3.5 shrink-0" />
        Ya tienes a <strong className="font-medium text-foreground">{personaLabel(conocido)}</strong>.
        <button type="button" className={boton} onClick={() => onEnlazar(conocido.id)}>
          Enlazar esta venta
        </button>
      </p>
    );
  }

  const guardar = () => {
    const { nombre, apellido } = partirNombre(texto);
    onGuardar(nombre, apellido);
  };

  return (
    <p className="flex flex-wrap items-center gap-1 text-[12.5px] text-muted-foreground">
      <UserPlus className="size-3.5 shrink-0" />
      «{texto}» todavía no es cliente.
      <button type="button" className={boton} onClick={guardar}>
        Guardarlo y ponerle el teléfono
      </button>
    </p>
  );
}
