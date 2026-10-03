import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuthContext } from '../../application/context/useAuthContext';
import { fraseDeSellos, useMiTarjeta } from '../../application/hooks/useMiTarjeta';
import { SellosMini } from './SellosMini';

/**
 * La portada, cuando el cliente ya entró: su nombre, cómo va su tarjeta y la
 * puerta a Mi cuenta.
 *
 * Antes la portada era idéntica para un visitante y para un cliente con
 * sesión: nada le decía que estaba dentro ni qué se le había abierto (dueño,
 * 2026-10-02). Los sellos van aquí porque son lo que hace volver: "te faltan 2"
 * es una razón para la próxima compra.
 */
export function FranjaCliente() {
  const { user, isAdmin } = useAuthContext();
  const { data } = useMiTarjeta();
  if (!user || isAdmin) return null;
  const frase = fraseDeSellos(data);

  return (
    <div className="border-b border-border/70 bg-brand-soft/50">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 md:px-8">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-foreground">Hola, {user.nombre} 👋</p>
          {frase && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
              {data && !data.premio_listo && <SellosMini sellos={data.sellos} objetivo={data.objetivo} />}
              <span>{frase}</span>
            </div>
          )}
        </div>
        <Link to="/mi-cuenta"
          className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-semibold text-primary hover:text-primary/80">
          Mi cuenta <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}
