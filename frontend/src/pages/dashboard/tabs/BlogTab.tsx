import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Eye, EyeOff, ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DialogFooter } from '@/components/ui/dialog';
import Modal from '../../../components/Modal';
import EditorHtml from '../../../components/EditorHtml';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { BASE_URL, authFetchWithRefresh } from '../../../infrastructure/api/client';
import { fmtInstante } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';
import type { GuardedFetch } from '../types';

interface Post {
  id: number; titulo: string; slug: string; resumen: string;
  contenido: string; portada: string | null; publicado: boolean; fecha: string;
}

const vacio = { titulo: '', resumen: '', contenido: '', portada: null as string | null, publicado: false };

/** Admin del blog: crear/editar entradas con editor de texto + publicar/ocultar. */
export function BlogTab({ guardedFetch }: { guardedFetch: GuardedFetch }) {
  const [rows, setRows] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [form, setForm] = useState(vacio);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const r = await guardedFetch(`${BASE_URL}/api/blog/admin?page=1&limit=50`);
    const j = await r.json();
    setRows(j.data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const abrirNuevo = () => { setForm(vacio); setError(''); setModal({ open: true, id: null }); };
  const abrirEditar = (p: Post) => {
    setForm({ titulo: p.titulo, resumen: p.resumen, contenido: p.contenido, portada: p.portada, publicado: p.publicado });
    setError(''); setModal({ open: true, id: p.id });
  };

  const subirPortada = async (file: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const res = await authFetchWithRefresh(`${BASE_URL}/api/blog/admin/portada`, { method: 'POST', body: fd });
      const j = await res.json();
      if (res.ok) setForm((f) => ({ ...f, portada: j.data.url }));
    } finally { setSubiendo(false); }
  };

  const guardar = async () => {
    if (!form.titulo.trim()) { setError('Ponle un título'); return; }
    if (!form.contenido.trim()) { setError('El contenido no puede estar vacío'); return; }
    setSaving(true); setError('');
    try {
      const url = modal.id ? `${BASE_URL}/api/blog/admin/${modal.id}` : `${BASE_URL}/api/blog/admin`;
      const res = await guardedFetch(url, { method: modal.id ? 'PATCH' : 'POST', body: JSON.stringify(form) });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? 'No se pudo guardar'); return; }
      setModal({ open: false, id: null }); load();
    } finally { setSaving(false); }
  };

  const togglePublicado = async (p: Post) => {
    await guardedFetch(`${BASE_URL}/api/blog/admin/${p.id}`, { method: 'PATCH', body: JSON.stringify({ ...p, publicado: !p.publicado }) });
    load();
  };
  const eliminar = async (p: Post) => {
    if (!window.confirm(`¿Eliminar "${p.titulo}"?`)) return;
    await guardedFetch(`${BASE_URL}/api/blog/admin/${p.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={rows.length}>Blog</SectionTitle>
        <ToolbarActions>
          <Button size="sm" onClick={abrirNuevo}>+ Nueva entrada</Button>
        </ToolbarActions>
      </Toolbar>

      {loading ? <PerfumeSpinner /> : rows.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">Aún no hay entradas. Crea la primera.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              {p.portada
                ? <img src={p.portada} alt="" className="size-12 shrink-0 rounded-lg border border-border object-cover" />
                : <div className="grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-secondary/50 text-muted-foreground/40">𝒫</div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-foreground">{p.titulo}</p>
                <p className="text-[11.5px] text-muted-foreground">{fmtInstante(p.fecha)}</p>
              </div>
              <Badge variant="outline" className={`rounded-full text-[10.5px] ${p.publicado ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-amber-300 bg-amber-50 text-amber-700'}`}>
                {p.publicado ? 'Publicada' : 'Borrador'}
              </Badge>
              <Button size="icon" variant="ghost" className="size-8" title={p.publicado ? 'Ocultar' : 'Publicar'} onClick={() => togglePublicado(p)}>
                {p.publicado ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="size-8" onClick={() => abrirEditar(p)}><Pencil className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" onClick={() => eliminar(p)}><Trash2 className="size-4" /></Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, id: null })}
        title={modal.id ? 'Editar entrada' : 'Nueva entrada'}
        maxWidth={720}
        footer={
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setModal({ open: false, id: null })}>Cancelar</Button>
            <Button onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
          </DialogFooter>
        }
      >
        <div className="space-y-4">
          <Field label="Título"><Input value={form.titulo} maxLength={200} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} /></Field>
          <Field label="Resumen (opcional)"><Textarea rows={2} maxLength={300} value={form.resumen} onChange={(e) => setForm((f) => ({ ...f, resumen: e.target.value }))} /></Field>
          <Field label="Portada (opcional)">
            <div className="flex items-center gap-3">
              {form.portada && <img src={form.portada} alt="" className="h-16 w-24 rounded-lg border border-border object-cover" />}
              <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
                {subiendo ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {form.portada ? 'Cambiar' : 'Subir'}
              </Button>
              {form.portada && <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setForm((f) => ({ ...f, portada: null }))}>Quitar</Button>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) subirPortada(e.target.files[0]); e.target.value = ''; }} />
            </div>
          </Field>
          <Field label="Contenido"><EditorHtml value={form.contenido} onChange={(html) => setForm((f) => ({ ...f, contenido: html }))} /></Field>
          <label className="flex items-center gap-2 text-[13.5px] text-foreground">
            <input type="checkbox" className="accent-primary" checked={form.publicado} onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))} />
            Publicar ahora (visible para todos)
          </label>
          {error && <p className="text-[12.5px] font-medium text-destructive">{error}</p>}
        </div>
      </Modal>
    </Section>
  );
}
