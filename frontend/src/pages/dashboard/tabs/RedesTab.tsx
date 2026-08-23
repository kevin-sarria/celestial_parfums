import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Upload, FileDown, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectSimple } from '@/components/ui/select-simple';
import PerfumeSpinner from '../../../components/PerfumeSpinner';
import { ContactoLinktree } from '../../../components/contacto/ContactoLinktree';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, ColorField } from '../ui';
import { emptyConfigForm, type ConfigForm } from './redes/configForm';
import { FilaEnlace } from './redes/FilaEnlace';
import { ModalEnlace, type LinkForm } from './redes/ModalEnlace';
import { subirImagenAdmin } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import type { ContactoConfig, ContactoForma, ContactoLink } from '../../../domain/entities/contacto.schema';



export function RedesTab() {
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
    const res = await http.get<{ data?: { config?: ContactoConfig; links?: ContactoLink[] } }>(urls.contacto.admin);
    if (!res.ok) { setConfigError(res.error); return; }
    const config = res.cuerpo?.data?.config;
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
    setLinks(res.cuerpo?.data?.links ?? []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
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
      const res = await http.patch(urls.contacto.config, {
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
      });
      if (!res.ok) { setConfigError(res.error); return; }
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
      const url = await subirImagenAdmin(file, urls.contacto.avatar);
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
      const url = await subirImagenAdmin(file, urls.contacto.fondo);
      setForm(f => ({ ...f, fondo_tipo: 'imagen', fondo_imagen: url }));
      setConfigMsg('Imagen de fondo subida y guardada ✓');
      setTimeout(() => setConfigMsg(''), 3000);
    } catch (err) { setConfigError(err instanceof Error ? err.message : 'No se pudo subir la imagen'); }
    finally { setUploadingFondo(false); }
  };

  /** Descarga config + links como respaldo JSON re-importable. */
  const exportConfig = async () => {
    setConfigError('');
    const res = await http.descargar(urls.contacto.exportar);
    if (!res.ok || !res.cuerpo) { setConfigError(res.error); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(res.cuerpo);
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
      const res = await http.post(urls.contacto.importar, parsed);
      if (!res.ok) { setConfigError(res.error); return; }
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
      const res = editingId
        ? await http.patch(urls.contacto.link(editingId), payload)
        : await http.post(urls.contacto.links, payload);
      if (!res.ok) { setLinkError(res.error); return; }
      setModalOpen(false);
      await load();
    } finally { setSavingLink(false); }
  };

  const deleteLink = async (id: number) => {
    if (!window.confirm('¿Eliminar este link?')) return;
    const res = await http.borrar(urls.contacto.link(id));
    if (!res.ok) { toast.error(res.error, { id: 'redes' }); return; }
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
    const res = await http.post(urls.contacto.reordenar, { ids: ordered.map(l => l.id) });
    // La flecha mueve el link en pantalla antes de que responda el servidor. Si
    // falla y no se recarga, la lista queda enseñando un orden que allá no existe.
    if (!res.ok) { toast.error(res.error, { id: 'redes' }); await load(); }
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
                <SelectSimple value={form.fondo_tipo} onChange={e => set('fondo_tipo', e.target.value as 'color' | 'imagen')}>
                  <option value="color">Color sólido</option>
                  <option value="imagen">Imagen</option>
                </SelectSimple>
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
                <SelectSimple
                  value={form.contenido_posicion}
                  onChange={e => set('contenido_posicion', e.target.value as ConfigForm['contenido_posicion'])}
                >
                  <option value="centro">Centrada en su mitad</option>
                  <option value="arriba">Pegada arriba</option>
                </SelectSimple>
              </Field>
              <Field label="Sección inferior · redes sociales">
                <SelectSimple
                  value={form.redes_posicion}
                  onChange={e => set('redes_posicion', e.target.value as ConfigForm['redes_posicion'])}
                >
                  <option value="centro">Centrada en su mitad</option>
                  <option value="abajo">Pegada abajo</option>
                </SelectSimple>
              </Field>
            </FieldRow>

            <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Estilo global de botones
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Forma">
                <SelectSimple value={form.boton_forma} onChange={e => set('boton_forma', e.target.value as ContactoForma)}>
                  <option value="redondo">Bordes redondos</option>
                  <option value="cuadrado">Cuadrado</option>
                </SelectSimple>
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
            {botones.map((l, i) => (
              <FilaEnlace
                key={l.id}
                link={l}
                esPrimero={i === 0}
                esUltimo={i === botones.length - 1}
                onSubir={() => moveLink(l, -1)}
                onBajar={() => moveLink(l, 1)}
                onEditar={() => openEdit(l)}
                onEliminar={() => deleteLink(l.id)}
              />
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Iconos de redes</p>
            {redes.length === 0 && (
              <p className="text-[13px] text-muted-foreground">Sin redes sociales aún. Se muestran como iconos al pie de la página.</p>
            )}
            {redes.map((l, i) => (
              <FilaEnlace
                key={l.id}
                link={l}
                esPrimero={i === 0}
                esUltimo={i === redes.length - 1}
                onSubir={() => moveLink(l, -1)}
                onBajar={() => moveLink(l, 1)}
                onEditar={() => openEdit(l)}
                onEliminar={() => deleteLink(l.id)}
              />
            ))}
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
      {/* ── Modal crear/editar link ── */}
      {linkForm && (
        <ModalEnlace
          abierto={modalOpen}
          editando={editingId !== null}
          form={linkForm}
          cambiar={setLink}
          onGuardar={submitLink}
          onCerrar={() => setModalOpen(false)}
          guardando={savingLink}
          error={linkError}
        />
      )}
    </div>
  );
}
