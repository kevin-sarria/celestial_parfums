import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';

/** Los seis contadores con los que se deduce el progreso. */
interface Progreso {
  accesorios_sin_ficha: number;
  lotes_sin_ficha_propia: number;
  productos: number;
  productos_publicados: number;
  con_ficha_accesorio: number;
  con_ficha_armado: number;
}

interface PrimerosPasosProductosProps {
  /** Abre la ficha en blanco (la misma que "+ Nuevo producto"). */
  onNuevoProducto: () => void;
  /** Sube un número cada vez que se guarda o borra algo, para refrescar sin recargar la página. */
  recargar?: number;
}

interface Paso {
  n: number;
  titulo: string;
  hecho: boolean;
  detalle: ReactNode;
  /**
   * Opcional a propósito: publicar no es una pantalla a la que llevar, sino una
   * acción dentro del menú ⋯ de cada fila. Un botón "Empezar" que abriera otra
   * cosa enseñaría el camino equivocado, así que ese paso solo explica dónde está.
   */
  accion?: ReactNode;
}

/**
 * Lista de arranque de la pestaña Productos.
 *
 * Nace porque, contra la base real del dueño, sus 222 perfumes son todos
 * `fabricado`: la pestaña arranca en 0 filas y una tabla en blanco no enseña
 * nada. El progreso se deduce SIEMPRE de los datos, nunca de una bandera de
 * "ya lo hizo" (mentiría el día que se importe por Excel o se borre un
 * registro), y ningún paso bloquea a otro: aquí no hay un orden que corrompa
 * datos si se invierte. Ver la skill `arranque-guiado`.
 */
export function PrimerosPasosProductos({ onNuevoProducto, recargar = 0 }: PrimerosPasosProductosProps) {
  const [p, setP] = useState<Progreso | null>(null);
  const [abierto, setAbierto] = useState(true);

  useEffect(() => {
    let vivo = true;
    // Silencioso a propósito: es una ayuda, no la pantalla. Si falla, la
    // pestaña sigue sirviendo igual y no tiene sentido alarmar.
    http.get<{ data?: Progreso }>(urls.perfumes.primerosPasosProductos)
      .then(r => { if (vivo && r.ok && r.cuerpo?.data) setP(r.cuerpo.data); });
    return () => { vivo = false; };
  }, [recargar]);

  if (!p) return null;

  const pasos: Paso[] = [
    {
      n: 1,
      titulo: 'Pon a la venta un accesorio que ya tienes',
      hecho: p.con_ficha_accesorio > 0,
      detalle: p.accesorios_sin_ficha > 0
        ? `Tienes ${p.accesorios_sin_ficha} en tu inventario sin ficha: hasta que la tengan, venderlos no descuenta nada y su costo entra en cero.`
        : 'El perfumero, la bolsa, la tarjeta. Se dan de alta desde el material, en Inventario.',
      accion: <Button size="sm" variant="outline" asChild><Link to="/dashboard/inventario">Empezar</Link></Button>,
    },
    {
      n: 2,
      titulo: 'Dale su ficha a un 1.1 que ya armaste',
      hecho: p.con_ficha_armado > 0,
      detalle: p.lotes_sin_ficha_propia > 0
        ? `Tienes ${p.lotes_sin_ficha_propia} lotes armados apuntando al perfume normal. Vender uno cobraría el precio del corriente.`
        : 'Un 1.1 es un perfume con envase premium: lleva su propia ficha y su propio precio.',
      accion: <Button size="sm" variant="outline" onClick={onNuevoProducto}>Empezar</Button>,
    },
    {
      n: 3,
      titulo: 'Muéstralos en tu tienda',
      hecho: p.productos_publicados > 0,
      detalle: p.productos > 0
        ? `${p.productos_publicados} de ${p.productos} se ven en la tienda. Para mostrar uno: menú ⋯ de su fila → «Devolver a la tienda».`
        : 'Nacen apagados a propósito: nadie ve una ficha a medio llenar. Cuando tengas el primero, lo enciendes desde el menú ⋯ de su fila.',
    },
  ];

  const listos = pasos.filter(s => s.hecho).length;
  // Terminado el arranque, la caja desaparece sola: ya cumplió su trabajo.
  if (listos === pasos.length) return null;

  return (
    <div className="rounded-2xl border border-primary/25 bg-brand-soft/40 px-4 py-3.5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Primeros pasos
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted-foreground">
            Haz esto una vez y tu tienda deja de estar vacía.
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-[12.5px] font-medium tabular-nums text-foreground">
            {listos} de {pasos.length}
          </span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {abierto && (
        <ol className="mt-3 flex flex-col gap-2">
          {pasos.map(s => (
            <li
              key={s.n}
              className={`flex flex-wrap items-start gap-3 rounded-xl border px-3 py-2.5 ${
                s.hecho ? 'border-border/60 bg-card/50' : 'border-border bg-card'
              }`}
            >
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  s.hecho ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'
                }`}
              >
                {s.hecho ? <Check className="size-3" /> : s.n}
              </span>

              <span className="min-w-40 flex-1">
                <span className={`block text-[13.5px] font-medium ${s.hecho ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {s.titulo}
                </span>
                <span className="mt-0.5 block text-[12px] text-muted-foreground">{s.detalle}</span>
              </span>

              {!s.hecho && s.accion && <span className="shrink-0">{s.accion}</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
