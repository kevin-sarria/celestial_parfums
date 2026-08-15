import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field } from '../ui';

interface Config { titulo: string; historia: string; imagen: string | null; activo: boolean }

/** Admin de la página pública "Sobre nosotros". */
export function SobreNosotrosTab() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const r = await http.get<{ data?: Config }>(urls.nosotros.config);
    setCfg(r.cuerpo?.data ?? null);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!cfg) return;
    setSaving(true); setMsg('');
    try {
      const r = await http.patch(urls.nosotros.config, {
        titulo: cfg.titulo, historia: cfg.historia, activo: cfg.activo,
      });
      // Antes solo avisaba cuando salía bien: si fallaba, no pasaba nada en
      // pantalla y el dueño creía que había guardado.
      setMsg(r.ok ? 'Guardado ✓' : r.error);
      if (r.ok) setTimeout(() => setMsg(''), 2000);
    } finally { setSaving(false); }
  };

  const subir = async (file: File) => {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append('imagen', file);
      const r = await http.subir<{ data: { imagen: string } }>(urls.nosotros.imagen, fd);
      if (r.ok && r.cuerpo) setCfg((c) => (c ? { ...c, imagen: r.cuerpo!.data.imagen } : c));
      else if (!r.ok) setMsg(r.error);
    } finally { setSubiendo(false); }
  };

  if (!cfg) return <Section><PerfumeSpinner /></Section>;

  return (
    <Section>
      <Toolbar>
        <SectionTitle>Sobre nosotros</SectionTitle>
        <ToolbarActions>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" className="accent-primary" checked={cfg.activo} onChange={(e) => setCfg({ ...cfg, activo: e.target.checked })} />
            Visible en la web
          </label>
          <Button size="sm" onClick={guardar} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </ToolbarActions>
      </Toolbar>

      <div className="space-y-4">
        <Field label="Título"><Input value={cfg.titulo} maxLength={200} onChange={(e) => setCfg({ ...cfg, titulo: e.target.value })} /></Field>
        <Field label="Imagen (opcional)">
          <div className="flex items-center gap-3">
            {cfg.imagen && <img src={cfg.imagen} alt="" className="h-20 w-32 rounded-lg border border-border object-cover" />}
            <Button type="button" variant="outline" size="sm" disabled={subiendo} onClick={() => fileRef.current?.click()}>
              {subiendo ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} {cfg.imagen ? 'Cambiar' : 'Subir'}
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) subir(e.target.files[0]); e.target.value = ''; }} />
          </div>
        </Field>
        <Field label="Historia / texto">
          <Textarea rows={10} value={cfg.historia} placeholder="Cuenta quién eres, cómo empezó Celestial Parfums, qué te diferencia…"
            onChange={(e) => setCfg({ ...cfg, historia: e.target.value })} />
        </Field>
        {msg && <p className="text-[13px] font-medium text-primary">{msg}</p>}
      </div>
    </Section>
  );
}
