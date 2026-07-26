import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Link2, Upload, FileDown, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { NativeSelect } from '@/components/ui/native-select';
import { cn } from '@/lib/utils';
import Modal from '../../../components/Modal';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { ContactoLinktree } from '../../../components/contacto/ContactoLinktree';
import { RED_OPTIONS, getRedIcon, getRedLabel } from '../../../components/contacto/redIcons';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, ColorField } from '../ui';
import { API_CONTACTO, subirImagenAdmin } from '../helpers';
import type { GuardedFetch } from '../types';
import type { ContactoConfig, ContactoForma, ContactoLink } from '../../../domain/entities/contacto.schema';

interface Props {
  guardedFetch: GuardedFetch;
}

interface ConfigForm {
  avatar_url: string;
  nombre: string;
  descripcion: string;
  fondo_tipo: 'color' | 'imagen';
  fondo_color: string;
  fondo_imagen: string;
  boton_forma: ContactoForma;
  boton_color_fondo: string;
  boton_color_texto: string;
  contenido_posicion: 'arriba' | 'centro';
  redes_posicion: 'centro' | 'abajo';
}

const emptyConfigForm = (): ConfigForm => ({
  avatar_url: '', nombre: 'Celestial Parfums', descripcion: '',
  fondo_tipo: 'color', fondo_color: '#f6f3ec', fondo_imagen: '',
  boton_forma: 'redondo', boton_color_fondo: '#ffffff', boton_color_texto: '#2f2a3d',
  contenido_posicion: 'centro', redes_posicion: 'centro',
});

interface LinkForm {
  tipo: 'boton' | 'red';
  nombre: string;
  plataforma: string;
  url: string;
  /** Qué se muestra como icono: nada, un emoji/texto o el icono de una plataforma. */
  iconoTipo: 'ninguno' | 'emoji' | 'red';
  emoji: string;
  iconoRed: string;
  usarGlobal: boolean;
  forma: ContactoForma;
  color_fondo: string;
  color_texto: string;
  activo: boolean;
}

export function RedesTab({ guardedFetch }: Props) {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<ContactoLink[]>([]);
  const [form, setForm] = useState<ConfigForm>(emptyConfigForm());

  const [savingConfig, setSavingConfig] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configError, setConfigError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const [uploadingFondo, setUploadingFondo] = useState(false);
  const fondoFileRef = useRef<HTMLInputElement>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [linkForm, setLinkForm] = useState<LinkForm | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [linkError, setLinkError] = useState('');

  const set = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const load = async () => {
    const res = await guardedFetch(`${API_CONTACTO}/admin`);
    const json = await res.json();
    const config: ContactoConfig = json.data?.config;
    if (config) {
      setForm({
        avatar_url: config.avatar_url ?? '',
        nombre: config.nombre,
        descripcion: config.descripcion ?? '',
        fondo_tipo: config.fondo_tipo,
        fondo_color: config.fondo_tipo === 'color' ? (config.fondo_valor ?? '#f6f3ec') : '#f6f3ec',
        fondo_imagen: config.fondo_tipo === 'imagen' ? (config.fondo_valor ?? '') : '',
        boton_forma: config.boton_forma,
        boton_color_fondo: config.boton_color_fondo,
        boton_color_texto: config.boton_color_texto,
        contenido_posicion: config.contenido_posicion,
        redes_posicion: config.redes_posicion,
      });
    }
    setLinks(json.data?.links ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const previewConfig: ContactoConfig = {
    avatar_url: form.avatar_url || null,
    nombre: form.nombre || 'Celestial Parfums',
    descripcion: form.descripcion || null,
    fondo_tipo: form.fondo_tipo,
    fondo_valor: form.fondo_tipo === 'color' ? form.fondo_color : form.fondo_imagen || null,
    boton_forma: form.boton_forma,
    boton_color_fondo: form.boton_color_fondo,
    boton_color_texto: form.boton_color_texto,
    contenido_posicion: form.contenido_posicion,
    redes_posicion: form.redes_posicion,
  };
  const previewLinks = links.filter(l => l.activo);

  const botones = links.filter(l => l.tipo === 'boton');
  const redes = links.filter(l => l.tipo === 'red');

  const saveConfig = async () => {
    setSavingConfig(true); setConfigMsg(''); setConfigError('');
    try {
      const res = await guardedFetch(`${API_CONTACTO}/config`, {
        method: 'PATCH',
        body: JSON.stringify({
          avatar_url: form.avatar_url.trim(),
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim(),
          fondo_tipo: form.fondo_tipo,
          fondo_valor: form.fondo_tipo === 'color' ? form.fondo_color : form.fondo_imagen.trim(),
          boton_forma: form.boton_forma,
          boton_color_fondo: form.boton_color_fondo,
          boton_color_texto: form.boton_color_texto,
          contenido_posicion: form.contenido_posicion,
          redes_posicion: form.redes_posicion,
        }),
      });
      const json = await res.json();
      if (!res.ok) { setConfigError(json.error ?? 'No se pudo guardar'); return; }
      setConfigMsg('Configuración guardada ✓');
      setTimeout(() => setConfigMsg(''), 3000);
    } finally { setSavingConfig(false); }
  };

  /** Sube el archivo elegido; el backend guarda la URL y borra el avatar anterior del disco. */
  const handleAvatarFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingAvatar(true); setConfigMsg(''); setConfigError('');
    try {
      const url = await subirImagenAdmin(guardedFetch, file, `${API_CONTACTO}/avatar`);
      set('avatar_url', url);
      setConfigMsg('Avatar subido y guardado ✓');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch (err) { setConfigError(err instanceof Error ? err.message : 'No se pudo subir la imagen'); }
    finally { setUploadingAvatar(false); }
  };

  /** Sube la imagen de fondo; el backend la deja activa y borra la anterior del disco. */
  const handleFondoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingFondo(true); setConfigMsg(''); setConfigError('');
    try {
      const url = await subirImagenAdmin(guardedFetch, file, `${API_CONTACTO}/fondo`);
      setForm(f => ({ ...f, fondo_tipo: 'imagen', fondo_imagen: url }));
      setConfigMsg('Imagen de fondo subida y guardada ✓');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch (err) { setConfigError(err instanceof Error ? err.message : 'No se pudo subir la imagen'); }
    finally { setUploadingFondo(false); }
  };

  /** Descarga config + links como respaldo JSON re-importable. */
  const exportConfig = async () => {
    setConfigError('');
    const res = await guardedFetch(`${API_CONTACTO}/export`);
    if (!res.ok) { setConfigError('No se pudo exportar la configuración'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contacto_config.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /** Importa un respaldo JSON reemplazando la configuración y los links actuales. */
  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setConfigMsg(''); setConfigError('');
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setConfigError('El archivo no es un JSON válido');
      return;
    }
    if (!window.confirm('Esto reemplazará la configuración y todos los links actuales. ¿Continuar?')) return;
    setImporting(true);
    try {
      const res = await guardedFetch(`${API_CONTACTO}/import`, {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) { setConfigError(json.error ?? 'No se pudo importar el archivo'); return; }
      await load();
      setConfigMsg('Configuración importada ✓');
      setTimeout(() => setConfigMsg(''), 3000);
    } finally { setImporting(false); }
  };

  const openCreate = () => {
    setEditingId(null);
    setLinkError('');
    setLinkForm({
      tipo: 'boton', nombre: '', plataforma: 'instagram', url: '',
      iconoTipo: 'ninguno', emoji: '', iconoRed: 'tiktok',
      usarGlobal: true, forma: form.boton_forma,
      color_fondo: form.boton_color_fondo, color_texto: form.boton_color_texto,
      activo: true,
    });
    setModalOpen(true);
  };

  const openEdit = (link: ContactoLink) => {
    setEditingId(link.id);
    setLinkError('');
    const tieneOverride = !!(link.forma || link.color_fondo || link.color_texto);
    setLinkForm({
      tipo: link.tipo,
      nombre: link.tipo === 'boton' ? link.nombre : '',
      plataforma: link.tipo === 'red' ? link.nombre : 'instagram',
      url: link.url,
      iconoTipo: link.icono ? 'red' : link.emoji ? 'emoji' : link.tipo === 'red' ? 'red' : 'ninguno',
      emoji: link.emoji ?? '',
      iconoRed: link.icono ?? 'tiktok',
      usarGlobal: !tieneOverride,
      forma: link.forma ?? form.boton_forma,
      color_fondo: link.color_fondo ?? form.boton_color_fondo,
      color_texto: link.color_texto ?? form.boton_color_texto,
      activo: link.activo,
    });
    setModalOpen(true);
  };

  const setLink = <K extends keyof LinkForm>(key: K, value: LinkForm[K]) =>
    setLinkForm(f => (f ? { ...f, [key]: value } : f));

  const submitLink = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!linkForm) return;
    setSavingLink(true); setLinkError('');
    try {
      const esBoton = linkForm.tipo === 'boton';
      const payload = {
        tipo: linkForm.tipo,
        nombre: esBoton ? linkForm.nombre.trim() : linkForm.plataforma,
        url: linkForm.url.trim(),
        emoji: linkForm.iconoTipo === 'emoji' ? linkForm.emoji.trim() : '',
        icono: esBoton && linkForm.iconoTipo === 'red' ? linkForm.iconoRed : '',
        forma: esBoton && !linkForm.usarGlobal ? linkForm.forma : null,
        color_fondo: esBoton && !linkForm.usarGlobal ? linkForm.color_fondo : null,
        color_texto: esBoton && !linkForm.usarGlobal ? linkForm.color_texto : null,
        activo: linkForm.activo,
      };
      const res = await guardedFetch(
        editingId ? `${API_CONTACTO}/links/${editingId}` : `${API_CONTACTO}/links`,
        { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(payload) },
      );
      const json = await res.json();
      if (!res.ok) { setLinkError(json.error ?? 'No se pudo guardar el link'); return; }
      setModalOpen(false);
      await load();
    } finally { setSavingLink(false); }
  };

  const deleteLink = async (id: number) => {
    if (!window.confirm('¿Eliminar este link?')) return;
    await guardedFetch(`${API_CONTACTO}/links/${id}`, { method: 'DELETE' });
    await load();
  };

  const moveLink = async (link: ContactoLink, dir: -1 | 1) => {
    const group = links.filter(l => l.tipo === link.tipo);
    const idx = group.findIndex(l => l.id === link.id);
    const target = idx + dir;
    if (target < 0 || target >= group.length) return;
    [group[idx], group[target]] = [group[target], group[idx]];
    const otros = links.filter(l => l.tipo !== link.tipo);
    const ordered = link.tipo === 'boton' ? [...group, ...otros] : [...otros, ...group];
    setLinks(ordered.map((l, i) => ({ ...l, orden: i + 1 })));
    await guardedFetch(`${API_CONTACTO}/links/reorder`, {
      method: 'POST',
      body: JSON.stringify({ ids: ordered.map(l => l.id) }),
    });
  };

  const renderRow = (link: ContactoLink, group: ContactoLink[], index: number) => {
    // Redes muestran su plataforma (salvo texto personalizado); botones su icono elegido
    const Icon = link.tipo === 'red'
      ? (link.emoji ? null : getRedIcon(link.nombre))
      : (link.icono ? getRedIcon(link.icono) : null);
    return (
      // flex-wrap + basis del contenido: en pantallas angostas los 4 controles
      // bajan a una segunda línea en lugar de aplastar el nombre a "C…"
      <div key={link.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-background px-3.5 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[15px]">
          {Icon ? <Icon className="size-4 text-primary" /> : (link.emoji || <Link2 className="size-4 text-primary" />)}
        </span>
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[13.5px] font-medium text-foreground">
              {link.tipo === 'red' ? getRedLabel(link.nombre) : link.nombre}
            </span>
            {!link.activo && (
              <Badge variant="outline" className="rounded-full text-[10.5px] text-muted-foreground">Inactivo</Badge>
            )}
            {(link.forma || link.color_fondo || link.color_texto) && (
              <Badge variant="secondary" className="rounded-full text-[10.5px] font-medium text-primary">Estilo propio</Badge>
            )}
          </div>
          <span className="block truncate text-[12px] text-muted-foreground">{link.url}</span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Subir"
            disabled={index === 0} onClick={() => moveLink(link, -1)}>
            <ArrowUp className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Bajar"
            disabled={index === group.length - 1} onClick={() => moveLink(link, 1)}>
            <ArrowDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" title="Editar"
            onClick={() => openEdit(link)}>
            <Pencil className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" title="Eliminar"
            onClick={() => deleteLink(link.id)}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    );
  };

  if (loading) return <PerfumeSpinner />;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0 space-y-5">
        {/* ── Configuración general ── */}
        <Section>
          <Toolbar>
            <SectionTitle>Página Contáctame</SectionTitle>
            <ToolbarActions>
              <input
                ref={importFileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button variant="outline" size="sm" disabled={importing} onClick={() => importFileRef.current?.click()}>
                <FileUp className="size-4" /> {importing ? 'Importando...' : 'Importar'}
              </Button>
              <Button variant="outline" size="sm" onClick={exportConfig}>
                <FileDown className="size-4" /> Exportar
              </Button>
              <Button size="sm" onClick={saveConfig} disabled={savingConfig}>
                {savingConfig ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </ToolbarActions>
          </Toolbar>

          {configMsg && <p className="text-[13px] font-medium text-primary">{configMsg}</p>}
          <FormError>{configError}</FormError>

          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Perfil</p>
            <FieldRow>
              <Field label="Nombre a mostrar">
                <Input value={form.nombre} maxLength={100} onChange={e => set('nombre', e.target.value)} />
              </Field>
              <Field label="Avatar">
                <div className="flex gap-2">
                  <Input
                    value={form.avatar_url}
                    placeholder="https://... o sube una imagen"
                    onChange={e => set('avatar_url', e.target.value)}
                  />
                  <input
                    ref={avatarFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handleAvatarFile}
                  />
                  <Button
                    type="button" variant="outline" className="h-9 shrink-0"
                    disabled={uploadingAvatar}
                    onClick={() => avatarFileRef.current?.click()}
                  >
                    <Upload className="size-4" /> {uploadingAvatar ? 'Subiendo...' : 'Subir'}
                  </Button>
                </div>
              </Field>
            </FieldRow>
            <Field label="Descripción corta">
              <Textarea
                value={form.descripcion} maxLength={500} rows={2}
                placeholder="Ej: Fragancias que elevan tus sentidos, encuentra la tuya."
                onChange={e => set('descripcion', e.target.value)}
              />
            </Field>

            <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fondo</p>
            <FieldRow>
              <Field label="Tipo de fondo">
                <NativeSelect value={form.fondo_tipo} onChange={e => set('fondo_tipo', e.target.value as 'color' | 'imagen')}>
                  <option value="color">Color sólido</option>
                  <option value="imagen">Imagen</option>
                </NativeSelect>
              </Field>
              {form.fondo_tipo === 'color' ? (
                <ColorField label="Color de fondo" value={form.fondo_color} onChange={v => set('fondo_color', v)} />
              ) : (
                <Field label="Imagen de fondo">
                  <div className="flex gap-2">
                    <Input
                      value={form.fondo_imagen}
                      placeholder="https://... o sube una imagen"
                      onChange={e => set('fondo_imagen', e.target.value)}
                    />
                    <input
                      ref={fondoFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handleFondoFile}
                    />
                    <Button
                      type="button" variant="outline" className="h-9 shrink-0"
                      disabled={uploadingFondo}
                      onClick={() => fondoFileRef.current?.click()}
                    >
                      <Upload className="size-4" /> {uploadingFondo ? 'Subiendo...' : 'Subir'}
                    </Button>
                  </div>
                </Field>
              )}
            </FieldRow>

            <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Distribución (la página se divide en dos mitades)
            </p>
            <FieldRow>
              <Field label="Sección superior · perfil y botones">
                <NativeSelect
                  value={form.contenido_posicion}
                  onChange={e => set('contenido_posicion', e.target.value as ConfigForm['contenido_posicion'])}
                >
                  <option value="centro">Centrada en su mitad</option>
                  <option value="arriba">Pegada arriba</option>
                </NativeSelect>
              </Field>
              <Field label="Sección inferior · redes sociales">
                <NativeSelect
                  value={form.redes_posicion}
                  onChange={e => set('redes_posicion', e.target.value as ConfigForm['redes_posicion'])}
                >
                  <option value="centro">Centrada en su mitad</option>
                  <option value="abajo">Pegada abajo</option>
                </NativeSelect>
              </Field>
            </FieldRow>

            <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Estilo global de botones
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Forma">
                <NativeSelect value={form.boton_forma} onChange={e => set('boton_forma', e.target.value as ContactoForma)}>
                  <option value="redondo">Bordes redondos</option>
                  <option value="cuadrado">Cuadrado</option>
                </NativeSelect>
              </Field>
              <ColorField label="Color del botón" value={form.boton_color_fondo} onChange={v => set('boton_color_fondo', v)} />
              <ColorField label="Color del texto" value={form.boton_color_texto} onChange={v => set('boton_color_texto', v)} />
            </div>
          </div>
        </Section>

        {/* ── Links ── */}
        <Section>
          <Toolbar>
            <SectionTitle count={links.length}>Links</SectionTitle>
            <ToolbarActions>
              <Button size="sm" onClick={openCreate}>
                <Plus className="size-4" /> Nuevo link
              </Button>
            </ToolbarActions>
          </Toolbar>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Botones</p>
            {botones.length === 0 && (
              <p className="text-[13px] text-muted-foreground">Aún no hay botones. Crea el primero con "Nuevo link".</p>
            )}
            {botones.map((l, i) => renderRow(l, botones, i))}
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Iconos de redes</p>
            {redes.length === 0 && (
              <p className="text-[13px] text-muted-foreground">Sin redes sociales aún. Se muestran como iconos al pie de la página.</p>
            )}
            {redes.map((l, i) => renderRow(l, redes, i))}
          </div>
        </Section>
      </div>

      {/* ── Vista previa en vivo ── */}
      <Section className="min-w-0 xl:sticky xl:top-0">
        <SectionTitle>Vista previa</SectionTitle>
        <div className="mx-auto w-full max-w-85 overflow-hidden rounded-4xl border-4 border-ink/85 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.4)]">
          <div className="h-140 overflow-y-auto bg-background">
            <ContactoLinktree config={previewConfig} links={previewLinks} className="min-h-full" />
          </div>
        </div>
        <p className="text-center text-[12px] text-muted-foreground">Así se verá la página /contactame</p>
      </Section>

      {/* ── Modal crear/editar link ── */}
      {linkForm && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingId ? 'Editar link' : 'Nuevo link'}
          onSubmit={submitLink}
          submitLabel={editingId ? 'Guardar cambios' : 'Crear link'}
          loading={savingLink}
          maxWidth={520}
        >
          <FormError>{linkError}</FormError>

          <Field label="Tipo">
            <NativeSelect
              value={linkForm.tipo}
              onChange={e => {
                const tipo = e.target.value as 'boton' | 'red';
                // Cada tipo tiene su icono por defecto: botón sin icono, red con el de su plataforma
                setLinkForm(f => (f ? { ...f, tipo, iconoTipo: tipo === 'red' ? 'red' : 'ninguno' } : f));
              }}
            >
              <option value="boton">Botón de link</option>
              <option value="red">Icono de red social</option>
            </NativeSelect>
          </Field>

          {linkForm.tipo === 'boton' ? (
            <>
              <Field label="Nombre a mostrar">
                <Input required value={linkForm.nombre} maxLength={100}
                  placeholder="Ej: Catálogo de perfumes"
                  onChange={e => setLink('nombre', e.target.value)} />
              </Field>
              <FieldRow>
                <Field label="Icono del botón">
                  <NativeSelect
                    value={linkForm.iconoTipo}
                    onChange={e => setLink('iconoTipo', e.target.value as LinkForm['iconoTipo'])}
                  >
                    <option value="ninguno">Sin icono</option>
                    <option value="emoji">Emoji o texto</option>
                    <option value="red">Icono de red social</option>
                  </NativeSelect>
                </Field>
                {linkForm.iconoTipo === 'emoji' && (
                  <Field label="Emoji o texto">
                    <Input value={linkForm.emoji} maxLength={8} placeholder="Ej: ✨"
                      onChange={e => setLink('emoji', e.target.value)} />
                  </Field>
                )}
                {linkForm.iconoTipo === 'red' && (
                  <Field label="Red social">
                    <NativeSelect value={linkForm.iconoRed} onChange={e => setLink('iconoRed', e.target.value)}>
                      {RED_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </NativeSelect>
                  </Field>
                )}
              </FieldRow>
            </>
          ) : (
            <FieldRow>
              <Field label="Plataforma">
                <NativeSelect value={linkForm.plataforma} onChange={e => setLink('plataforma', e.target.value)}>
                  {RED_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Contenido del círculo">
                <div className="flex gap-2">
                  <NativeSelect
                    value={linkForm.iconoTipo === 'emoji' ? 'emoji' : 'red'}
                    onChange={e => setLink('iconoTipo', e.target.value as LinkForm['iconoTipo'])}
                  >
                    <option value="red">Icono de la plataforma</option>
                    <option value="emoji">Emoji o letras</option>
                  </NativeSelect>
                  {linkForm.iconoTipo === 'emoji' && (
                    <Input value={linkForm.emoji} maxLength={8} placeholder="Ej: KD"
                      className="max-w-24"
                      onChange={e => setLink('emoji', e.target.value)} />
                  )}
                </div>
              </Field>
            </FieldRow>
          )}

          <Field label="Link (URL)">
            <Input required type="url" value={linkForm.url} placeholder="https://..."
              onChange={e => setLink('url', e.target.value)} />
          </Field>

          {linkForm.tipo === 'boton' && (
            <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
              <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={linkForm.usarGlobal}
                  onChange={e => setLink('usarGlobal', e.target.checked)}
                />
                Usar el estilo global de botones
              </label>
              {!linkForm.usarGlobal && (
                <div className={cn('grid gap-3 sm:grid-cols-3')}>
                  <Field label="Forma">
                    <NativeSelect value={linkForm.forma} onChange={e => setLink('forma', e.target.value as ContactoForma)}>
                      <option value="redondo">Bordes redondos</option>
                      <option value="cuadrado">Cuadrado</option>
                    </NativeSelect>
                  </Field>
                  <ColorField label="Color del botón" value={linkForm.color_fondo} onChange={v => setLink('color_fondo', v)} />
                  <ColorField label="Color del texto" value={linkForm.color_texto} onChange={v => setLink('color_texto', v)} />
                </div>
              )}
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-foreground">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={linkForm.activo}
              onChange={e => setLink('activo', e.target.checked)}
            />
            Visible en la página
          </label>
        </Modal>
      )}
    </div>
  );
}
