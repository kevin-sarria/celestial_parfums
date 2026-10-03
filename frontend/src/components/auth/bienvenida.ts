import { toast } from 'sonner';

/**
 * El saludo al entrar. Antes de esto nada cambiaba en pantalla al iniciar
 * sesión: la portada era idéntica a la de un visitante y el cliente no sabía si
 * ya estaba dentro ni qué se le había abierto (dueño, 2026-10-02).
 */
export const darBienvenida = (nombre: string | undefined, irAMiCuenta: () => void) =>
  toast.success(`¡Hola${nombre ? `, ${nombre}` : ''}! Ya estás dentro`, {
    id: 'bienvenida',
    description: 'Tus sellos, compras y favoritos te esperan en Mi cuenta.',
    action: { label: 'Ver', onClick: irAMiCuenta },
  });
