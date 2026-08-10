import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Modal from './Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BASE_URL } from '../infrastructure/api/client';
import {
  OPCIONES_POR_DEFECTO, describirSeleccion, gamasDelCatalogo, seleccionar,
  type OpcionesCatalogo,
} from '../utils/catalogoFiltros';
import type { Perfume } from '../domain/entities/perfume.schema';
import type { FormulaVolumen } from '../domain/entities/cotizacion.types';

const GENEROS = [
  { id: 'dama', label: 'Dama' },
  { id: 'caballero', label: 'Caballero' },
  { id: 'unisex', label: 'Unisex' },
];

const MEMORIA = 'celestial_catalogo_pdf_opciones';

function Casilla({ label, nota, checked, onChange }: {
  label: string; nota?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2">
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[12.5px] leading-snug">
        <span className="text-foreground">{label}</span>
        {nota && <span className="block text-[11.5px] text-muted-foreground">{nota}</span>}
      </span>
    </label>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      <p className="mb-2 text-[12.5px] font-medium text-foreground">{titulo}</p>
      {children}
    </div>
  );
}

/**
 * Modal para elegir QUÉ va en el catálogo PDF antes de generarlo.
 *
 * Antes se exportaban los 212 perfumes con todo, sin opción: si el dueño quería
 * mandarle a un cliente solo las árabes, o un catálogo sin precios, no había
 * forma. Ahora se segmenta por calidad de esencia, género y disponibilidad.
 *
 * La regla que gobierna el diseño: **nunca dejar caer perfumes en silencio.**
 * Se dice cuántos entran y, sobre todo, cuántos NO y por qué — el mismo fallo
 * que dejó el PDF con 100 de 212 sin que nadie se enterara.
 */
export default function ExportarCatalogoModal({ open, onClose }: {
  open: boolean; onClose: () => void;
}) {
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [formulas, setFormulas] = useState<FormulaVolumen[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [progreso, setProgreso] = useState<string | null>(null);
  const [o, setO] = useState<OpcionesCatalogo>(OPCIONES_POR_DEFECTO);

  const set = <K extends keyof OpcionesCatalogo>(k: K, v: OpcionesCatalogo[K]) =>
    setO((prev) => ({ ...prev, [k]: v }));

  const alternar = (k: 'gamas' | 'generos', valor: never) =>
    setO((prev) => {
      const lista = prev[k] as (string | number)[];
      const yaEsta = lista.some((x) => x === valor);
      return { ...prev, [k]: yaEsta ? lista.filter((x) => x !== valor) : [...lista, valor] };
    });

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setCargando(true);
    setError('');
    (async () => {
      try {
        const [resCat, resFor] = await Promise.all([
          fetch(`${BASE_URL}/api/parfums`, { credentials: 'include' }),
          // Si fallan las recetas no se cae el modal: el filtro de "puedo armar
          // hoy" se vuelve menos fino, pero todo lo demás sigue sirviendo.
          fetch(`${BASE_URL}/api/costeo/formulas`, { credentials: 'include' }).catch(() => null),
        ]);
        const json = await resCat.json();
        const lista: Perfume[] = Array.isArray(json?.data) ? json.data : (json?.data?.data ?? []);
        if (!vivo) return;
        setPerfumes(lista);
        if (resFor?.ok) setFormulas((await resFor.json()).data ?? []);

        // Arranca con TODO marcado: exportar el catálogo completo es lo normal,
        // y así el primer estado que ve coincide con lo que había antes.
        const guardado = localStorage.getItem(MEMORIA);
        const gamas = gamasDelCatalogo(lista).map((g) => g.id);
        setO(guardado
          ? { ...OPCIONES_POR_DEFECTO, ...JSON.parse(guardado) }
          : { ...OPCIONES_POR_DEFECTO, gamas, generos: GENEROS.map((g) => g.id) });
      } catch {
        if (vivo) setError('No se pudo cargar el catálogo');
      } finally {
        if (vivo) setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [open]);

  const gamas = useMemo(() => gamasDelCatalogo(perfumes), [perfumes]);
  const sinGamaTotal = useMemo(() => perfumes.filter((p) => p.gama_id == null).length, [perfumes]);
  const sel = useMemo(() => seleccionar(perfumes, o, formulas), [perfumes, o, formulas]);
  const descripcion = useMemo(() => describirSeleccion(o, gamas), [o, gamas]);

  const generar = async () => {
    if (progreso) return;
    localStorage.setItem(MEMORIA, JSON.stringify(o));
    setProgreso('Preparando…');
    try {
      const { generarCatalogoPdf } = await import('../utils/catalogoPdf');
      await generarCatalogoPdf(sel.incluidos, o, descripcion, setProgreso);
      toast.success(`Catálogo generado con ${sel.incluidos.length} perfumes`);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el catálogo', { id: 'pdf' });
    } finally {
      setProgreso(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Exportar catálogo en PDF"
      maxWidth={620}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={generar} disabled={!!progreso || sel.incluidos.length === 0}>
            {progreso && <Loader2 className="size-3.5 animate-spin" />}
            {progreso ?? `Generar PDF (${sel.incluidos.length})`}
          </Button>
        </div>
      }
    >
      {cargando ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Cargando el catálogo…</p>
      ) : error ? (
        <p className="py-6 text-center text-[13px] text-destructive">{error}</p>
      ) : (
        <>
          <Bloque titulo="¿Qué perfumes van?">
            <p className="mb-1.5 text-[11.5px] text-muted-foreground">
              Calidad de la esencia
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {gamas.map((g) => (
                <Casilla key={g.id} label={`${g.nombre} (${g.total})`}
                  checked={o.gamas.includes(g.id)}
                  onChange={() => alternar('gamas', g.id as never)} />
              ))}
              {/* Con su propia casilla y su número: si se filtra por gama estos
                  desaparecerían sin que nadie note que faltan. */}
              {sinGamaTotal > 0 && (
                <Casilla label={`Sin esencia asignada (${sinGamaTotal})`}
                  nota="Todavía no sabes con qué se arman"
                  checked={o.sinGama} onChange={(v) => set('sinGama', v)} />
              )}
            </div>

            <p className="mb-1.5 mt-3 text-[11.5px] text-muted-foreground">Para quién es</p>
            <div className="grid grid-cols-2 gap-1.5">
              {GENEROS.map((g) => (
                <Casilla key={g.id} label={g.label}
                  checked={o.generos.includes(g.id)}
                  onChange={() => alternar('generos', g.id as never)} />
              ))}
              <Casilla label="Sin género puesto" checked={o.sinGenero}
                onChange={(v) => set('sinGenero', v)} />
            </div>

            <div className="mt-3 space-y-1.5 border-t border-border pt-2.5">
              <Casilla label="Incluir los agotados" checked={o.incluirAgotados}
                onChange={(v) => set('incluirAgotados', v)} />
              <Casilla label="Solo los que puedo armar hoy"
                nota="Que alcance la esencia para al menos un frasco del tamaño más pequeño"
                checked={o.soloFabricablesHoy} onChange={(v) => set('soloFabricablesHoy', v)} />
              <Casilla label="Solo los que tienen foto"
                nota="Evita los espacios en blanco en el documento"
                checked={o.soloConFoto} onChange={(v) => set('soloConFoto', v)} />
            </div>
          </Bloque>

          <Bloque titulo="¿Qué información va de cada uno?">
            <div className="grid grid-cols-2 gap-1.5">
              <Casilla label="Precio" checked={o.precio} onChange={(v) => set('precio', v)} />
              <Casilla label="Foto" checked={o.foto} onChange={(v) => set('foto', v)} />
              <Casilla label="Notas olfativas" checked={o.notas} onChange={(v) => set('notas', v)} />
              <Casilla label="Ocasiones" checked={o.ocasiones} onChange={(v) => set('ocasiones', v)} />
              <Casilla label="Duración" checked={o.duracion} onChange={(v) => set('duracion', v)} />
              <Casilla label="Para quién es" checked={o.genero} onChange={(v) => set('genero', v)} />
            </div>
            {!o.precio && (
              <label className="mt-2.5 block">
                <span className="mb-1 block text-[11.5px] text-muted-foreground">
                  ¿Qué ponemos donde iría el precio?
                </span>
                <Input value={o.textoSinPrecio} maxLength={40} className="h-8 text-[12.5px]"
                  placeholder="Precios por WhatsApp"
                  onChange={(e) => set('textoSinPrecio', e.target.value)} />
              </label>
            )}
            <div className="mt-2.5 border-t border-border pt-2.5">
              <Casilla label="Agrupar por calidad de esencia"
                nota="Una sección por gama, con su título"
                checked={o.agruparPorGama} onChange={(v) => set('agruparPorGama', v)} />
            </div>
          </Bloque>

          {/* El número ANTES de generar: armar el PDF baja todas las fotos y se
              demora, así que enterarse después de que salió mal es caro. */}
          <div className="rounded-lg border border-primary/40 bg-brand-soft/50 p-3 text-[12.5px]">
            <p className="text-foreground">
              Vas a exportar <strong>{sel.incluidos.length}</strong> de {sel.total} perfumes
              {descripcion && <> — <strong>{descripcion}</strong></>}.
            </p>
            {sel.fuera.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted-foreground">
                {sel.fuera.map((f) => (
                  <li key={f.motivo}>· Se quedan afuera {f.cantidad} porque {f.motivo}.</li>
                ))}
              </ul>
            )}
            {sel.incluidos.length === 0 && (
              <p className="mt-1.5 text-[11.5px] font-medium text-destructive">
                Así no queda ningún perfume. Marca al menos una calidad de esencia y un género.
              </p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
