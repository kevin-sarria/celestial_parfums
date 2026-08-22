import { useRef, useState } from 'react';
import { ImagePlus, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

export interface ProductoComprado {
  id: number;
  nombre: string;
  imagen_url: string | null;
  resena: { rating: number; comentario: string; imagenes: string[]; estado: 'pendiente' | 'aprobada' | 'rechazada' } | null;
}

const ESTADO_BADGE: Record<string, { txt: string; cls: string }> = {
  pendiente: { txt: 'En revisión', cls: 'border-amber-300 bg-amber-50 text-amber-700' },
  aprobada: { txt: 'Publicada', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  rechazada: { txt: 'No aprobada', cls: 'border-rose-300 bg-rose-50 text-rose-700' },
};

/** Tarjeta de un producto comprado con su formulario de reseña (estrellas, texto, hasta 3 fotos). */
export default function ResenaProductoCard({ producto, onGuardada }: { producto: ProductoComprado; onGuardada: () => void }) {
  const r = producto.resena;
  const [rating, setRating] = useState(r?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState(r?.comentario ?? '');
  const [conservar, setConservar] = useState<string[]>(r?.imagenes ?? []);
  const [nuevas, setNuevas] = useState<File[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const totalFotos = conservar.length + nuevas.length;

  const agregarFotos = (files: FileList | null) => {
    if (!files) return;
    const libres = 3 - totalFotos;
    // Copiar la lista AQUÍ, no dentro del updater: `files` es un FileList vivo
    // del input y limpiarlo abajo lo vacía antes de que React lo lea.
    const elegidas = Array.from(files);
    setNuevas((n) => [...n, ...elegidas.slice(0, libres)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const enviar = async () => {
    if (rating < 1) { setError('Elige cuántas estrellas le das'); return; }
    setGuardando(true); setError(''); setMsg('');
    const fd = new FormData();
    fd.append('perfume_id', String(producto.id));
    fd.append('rating', String(rating));
    fd.append('comentario', comentario.trim());
    conservar.forEach((u) => fd.append('conservar', u));
    nuevas.forEach((f) => fd.append('imagenes', f));
    const res = await http.subir<{ data?: { imagenes?: string[] } }>(urls.resenas.crear, fd);
    setGuardando(false);
    if (!res.ok) { setError(res.error); return; }
    // Refleja lo que quedó guardado en el servidor (las nuevas ya son WebP con URL real)
    setConservar(res.cuerpo?.data?.imagenes ?? []);
    setNuevas([]);
    setMsg('¡Gracias! Tu reseña quedó en revisión.');
    onGuardada();
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        {producto.imagen_url && (
          <img src={producto.imagen_url} alt={producto.nombre} className="size-14 rounded-xl border border-border bg-white object-contain p-1" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-medium text-ink">{producto.nombre}</p>
          {r && <Badge variant="outline" className={cn('mt-0.5 rounded-full text-[10.5px]', ESTADO_BADGE[r.estado].cls)}>{ESTADO_BADGE[r.estado].txt}</Badge>}
        </div>
      </div>

      {/* Estrellas */}
      <div className="mt-3 flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} aria-label={`${n} estrellas`}>
            <Star className="size-6 transition-colors" style={{ color: '#d9b45a', fill: (hover || rating) >= n ? '#d9b45a' : 'transparent' }} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      <Textarea rows={2} maxLength={2000} value={comentario} placeholder="Cuenta qué te pareció (opcional)…"
        className="mt-2" onChange={(e) => setComentario(e.target.value)} />

      {/* Fotos */}
      <div className="mt-2 flex flex-wrap gap-2">
        {conservar.map((u) => (
          <div key={u} className="relative size-16">
            <img src={u} alt="" className="size-16 rounded-lg border border-border object-cover" />
            <button type="button" aria-label="Quitar" className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-background"
              onClick={() => setConservar((c) => c.filter((x) => x !== u))}><X className="size-3" /></button>
          </div>
        ))}
        {nuevas.map((f, i) => (
          <div key={i} className="relative size-16">
            <img src={URL.createObjectURL(f)} alt="" className="size-16 rounded-lg border border-border object-cover" />
            <button type="button" aria-label="Quitar" className="absolute -right-1.5 -top-1.5 rounded-full bg-ink p-0.5 text-background"
              onClick={() => setNuevas((n) => n.filter((_, x) => x !== i))}><X className="size-3" /></button>
          </div>
        ))}
        {totalFotos < 3 && (
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex size-16 flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
            <ImagePlus className="size-5" />
            <span className="text-[10px]">Foto</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => agregarFotos(e.target.files)} />
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Hasta 3 fotos. Se comprimen solas para subir rápido.</p>

      {error && <p className="mt-2 text-[12.5px] font-medium text-destructive">{error}</p>}
      {msg && <p className="mt-2 text-[12.5px] font-medium text-primary">{msg}</p>}

      <Button size="sm" className="mt-3 rounded-full" disabled={guardando} onClick={enviar}>
        {guardando ? 'Enviando…' : r ? 'Actualizar reseña' : 'Enviar reseña'}
      </Button>
    </div>
  );
}
