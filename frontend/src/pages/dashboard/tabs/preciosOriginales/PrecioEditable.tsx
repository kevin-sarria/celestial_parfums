import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { formatPrice } from '../../helpers';

/**
 * El precio de hoy, editable en su propia celda: un toque lo vuelve casilla,
 * Enter guarda, Esc o salir sin cambios lo deja como estaba. Así un caso
 * puntual no obliga a abrir la ficha del perfume.
 */
export function PrecioEditable({ precio, etiqueta, onGuardar }: {
  precio: number;
  /** "Khamrah Original, Decant 5 ml": para el nombre accesible. */
  etiqueta: string;
  onGuardar: (precio: number) => Promise<boolean>;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const n = Math.round(Number(texto));
    if (!(n > 0) || n === precio) { setTexto(null); return; }
    setGuardando(true);
    const ok = await onGuardar(n);
    setGuardando(false);
    if (ok) setTexto(null);
  };

  if (texto != null) {
    return (
      <Input
        autoFocus
        type="number"
        inputMode="numeric"
        min={1}
        aria-label={`Precio de ${etiqueta}`}
        className="h-8 w-28 tabular-nums"
        value={texto}
        disabled={guardando}
        onChange={e => setTexto(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); guardar(); }
          if (e.key === 'Escape') { e.stopPropagation(); setTexto(null); }
        }}
        onBlur={guardar}
      />
    );
  }
  return (
    <button type="button" title="Cambiar el precio" aria-label={`Cambiar el precio de ${etiqueta}`}
      className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 tabular-nums hover:bg-secondary"
      onClick={() => setTexto(precio > 0 ? String(precio) : '')}>
      {precio > 0 ? formatPrice(precio) : <span className="text-amber-700">Sin precio</span>}
      <Pencil className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}
