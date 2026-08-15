import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

export interface EntregaCliente {
  id: number;
  premio: string;
  imagenes: string[];
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  fecha: string;
}

const ESTADO: Record<string, { txt: string; cls: string }> = {
  pendiente: { txt: 'En revisión', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  aprobada: { txt: 'Publicada 🎉', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  rechazada: { txt: 'No aprobada', cls: 'border-rose-300 bg-rose-50 text-rose-700' },
};

/**
 * Bloque para que el CLIENTE suba fotos de su premio ganado (galería de
 * ganadores). Vuelve a quedar en revisión al subir. Máximo 3 fotos.
 */
interface Props {
  entrega: EntregaCliente;
  onSubido: () => void;
  /** Ruta destino; por defecto la del cliente. El admin pasa la suya. */
  url?: string;
  /** Muestra la nota "sube tu foto"; se oculta en el admin. */
  nota?: boolean;
}

export default function SubirFotosEntrega({ entrega, onSubido, url, nota = true }: Props) {
  const [conservar, setConservar] = useState<string[]>(entrega.imagenes);
  const [nuevas, setNuevas] = useState<File[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const total = conservar.length + nuevas.length;

  const subir = async () => {
    if (nuevas.length === 0) return;
    setSubiendo(true);
    try {
      const fd = new FormData();
      conservar.forEach((u) => fd.append('conservar', u));
      nuevas.forEach((f) => fd.append('imagenes', f));
      const destino = url ?? urls.recompensas.subirFotos(entrega.id);
      const res = await http.subir<{ data?: { imagenes?: string[] } }>(destino, fd);
      // Antes el fallo era mudo: el cliente elegía sus fotos, pulsaba "Enviar" y
      // no pasaba nada en pantalla.
      if (!res.ok) { toast.error(res.error, { id: 'fotos-entrega' }); return; }
      if (res.cuerpo?.data?.imagenes) setConservar(res.cuerpo.data.imagenes);
      setNuevas([]);
      onSubido();
    } finally { setSubiendo(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13.5px] font-medium text-foreground">🎁 {entrega.premio}</p>
        <Badge variant="outline" className={cn('rounded-full text-[10.5px]', ESTADO[entrega.estado].cls)}>{ESTADO[entrega.estado].txt}</Badge>
      </div>
      {nota && <p className="mt-1 text-[12px] text-muted-foreground">Sube una foto con tu premio para salir en "Nuestros ganadores".</p>}

      <div className="mt-2 flex flex-wrap gap-2">
        {conservar.map((u) => (
          <img key={u} src={u} alt="" className="size-16 rounded-lg border border-border object-cover" />
        ))}
        {nuevas.map((f, i) => (
          <img key={i} src={URL.createObjectURL(f)} alt="" className="size-16 rounded-lg border border-border object-cover" />
        ))}
        {total < 3 && (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary">
            <ImagePlus className="size-5" /><span className="text-[10px]">Foto</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => {
            // Copiar la lista YA: `e.target.files` es un FileList vivo y
            // limpiar el input (línea siguiente) lo vacía antes de que React
            // ejecute el updater, así que las fotos se perderían.
            const elegidas = e.target.files ? Array.from(e.target.files) : [];
            if (elegidas.length) setNuevas((n) => [...n, ...elegidas.slice(0, 3 - total)]);
            if (fileRef.current) fileRef.current.value = '';
          }} />
      </div>

      {nuevas.length > 0 && (
        <Button size="sm" className="mt-3 rounded-full" disabled={subiendo} onClick={subir}>
          {subiendo ? 'Enviando…' : 'Enviar fotos'}
        </Button>
      )}
    </div>
  );
}
