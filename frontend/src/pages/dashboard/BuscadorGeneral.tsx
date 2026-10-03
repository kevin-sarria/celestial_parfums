import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

interface Resultado {
  grupo: string;
  titulo: string;
  detalle: string;
  tab: string;
  buscar: string;
}

/**
 * EL BUSCADOR GENERAL (2026-10-02): una lupa arriba, o Ctrl+K en el computador.
 *
 * Escribes "Laura" o "Khamrah" y salen la clienta, sus ventas, su crédito y la
 * ficha, juntos; al elegir uno, la pestaña abre ya filtrada por ese texto
 * (`useBuscarDeUrl`). Antes había que saber en qué pestaña vivía cada cosa.
 * Se maneja con el teclado: ↑ ↓ para moverse y Enter para ir.
 */
export default function BuscadorGeneral() {
  const navigate = useNavigate();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [fallo, setFallo] = useState('');
  const [activo, setActivo] = useState(0);
  const pedido = useRef(0);

  // Ctrl+K / ⌘K desde cualquier pestaña
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setAbierto(true); }
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);

  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) { setResultados([]); setFallo(''); return; }
    const este = ++pedido.current;
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await http.get<{ data: Resultado[] }>(urls.buscar(q));
        if (este !== pedido.current) return; // ya se escribió otra cosa
        setResultados(res.cuerpo?.data ?? []);
        setFallo(res.ok ? '' : res.error);
        setActivo(0);
      } catch {
        if (este === pedido.current) setFallo('No se pudo conectar con el servidor');
      } finally {
        if (este === pedido.current) setBuscando(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [texto]);

  const grupos = useMemo(() => {
    const m = new Map<string, { r: Resultado; i: number }[]>();
    resultados.forEach((r, i) => m.set(r.grupo, [...(m.get(r.grupo) ?? []), { r, i }]));
    return [...m];
  }, [resultados]);

  const cerrar = (abrir: boolean) => {
    setAbierto(abrir);
    if (!abrir) { setTexto(''); setResultados([]); setFallo(''); }
  };

  const ir = (r: Resultado) => {
    cerrar(false);
    navigate(`/dashboard/${r.tab}?buscar=${encodeURIComponent(r.buscar)}`);
  };

  const alTeclear = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActivo(a => Math.min(a + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActivo(a => Math.max(a - 1, 0)); }
    if (e.key === 'Enter' && resultados[activo]) { e.preventDefault(); ir(resultados[activo]); }
  };

  const q = texto.trim();
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Buscar en todo el panel"
        className="flex h-9 items-center gap-2 rounded-full border border-border px-2.5 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground md:w-56 md:px-3"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left md:inline">Buscar…</span>
        <kbd className="hidden rounded border border-border px-1.5 text-[10.5px] font-medium md:inline">Ctrl K</kbd>
      </button>

      <Dialog open={abierto} onOpenChange={cerrar}>
        <DialogContent showCloseButton={false} className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Buscar en todo el panel</DialogTitle>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={alTeclear}
              placeholder="Cliente, perfume, venta #812, material…"
              aria-label="Qué buscas"
              className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox" aria-label="Resultados">
            {q.length < 2 && (
              <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                Escribe al menos 2 letras. Busca en el catálogo, los clientes, las ventas, los créditos y los materiales.
              </p>
            )}
            {q.length >= 2 && fallo && <p className="px-3 py-6 text-center text-[13px] text-destructive">{fallo}</p>}
            {q.length >= 2 && !fallo && !buscando && resultados.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">Nada con "{q}".</p>
            )}
            {grupos.map(([grupo, filas]) => (
              <div key={grupo} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{grupo}</p>
                {filas.map(({ r, i }) => (
                  <button
                    key={`${grupo}-${i}`} type="button" role="option" aria-selected={i === activo}
                    onMouseEnter={() => setActivo(i)} onClick={() => ir(r)}
                    className={cn('flex w-full flex-col items-start rounded-lg px-3 py-2 text-left',
                      i === activo ? 'bg-brand-soft' : 'hover:bg-secondary')}
                  >
                    <span className="text-[14px] font-medium text-foreground">{r.titulo}</span>
                    <span className="line-clamp-1 text-[12px] text-muted-foreground">{r.detalle}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
