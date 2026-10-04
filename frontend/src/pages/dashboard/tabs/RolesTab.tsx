import { useEffect, useMemo, useState } from 'react';
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Modal from '../../../components/Modal';
import { NoSePudoCargar } from '../../../components/NoSePudoCargar';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Field, Section, SectionTitle, Toolbar, ToolbarActions } from '../ui';

interface Permiso { clave: string; grupo: string; etiqueta: string; ayuda?: string }
interface Rol { id: number; nombre: string; permisos: string[]; personas: number }

/**
 * ROLES DEL PERSONAL (2026-10-04, opción C del dueño): él crea un rol, le
 * marca casillas y en Usuarios se lo asigna a quien trabaja con él.
 *
 * Las casillas salen del servidor (`permisos/catalogo.ts`): solo existen las
 * que el servidor de verdad revisa. Lo que no tiene casilla es solo del dueño.
 */
export function RolesTab() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [catalogo, setCatalogo] = useState<Permiso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState('');
  const [editando, setEditando] = useState<Rol | 'nuevo' | null>(null);
  const [nombre, setNombre] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const [r, c] = await Promise.all([
        http.get<{ data: Rol[] }>(urls.roles.lista),
        http.get<{ data: Permiso[] }>(urls.roles.permisos),
      ]);
      if (!r.ok || !c.ok) { setFallo(r.ok ? c.error : r.error); return; }
      setRoles(r.cuerpo?.data ?? []);
      setCatalogo(c.cuerpo?.data ?? []);
      setFallo('');
    } catch { setFallo('No se pudo conectar con el servidor'); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const grupos = useMemo(() => {
    const m = new Map<string, Permiso[]>();
    catalogo.forEach(p => m.set(p.grupo, [...(m.get(p.grupo) ?? []), p]));
    return [...m];
  }, [catalogo]);
  const etiqueta = (clave: string) => catalogo.find(p => p.clave === clave)?.etiqueta ?? clave;

  const abrir = (rol: Rol | 'nuevo') => {
    setEditando(rol);
    setNombre(rol === 'nuevo' ? '' : rol.nombre);
    setMarcados(new Set(rol === 'nuevo' ? [] : rol.permisos));
  };

  const alternar = (clave: string) => setMarcados(prev => {
    const s = new Set(prev);
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    return s;
  });

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!editando) return;
    setGuardando(true);
    try {
      const cuerpo = { nombre, permisos: [...marcados] };
      const res = editando === 'nuevo'
        ? await http.post<{ data: Rol }>(urls.roles.lista, cuerpo)
        : await http.patch<{ data: Rol }>(urls.roles.uno(editando.id), cuerpo);
      if (!res.ok || !res.cuerpo) { toast.error(res.error, { id: 'roles' }); return; }
      const rol = res.cuerpo.data;
      setRoles(prev => (editando === 'nuevo' ? [...prev, rol] : prev.map(r => (r.id === rol.id ? rol : r)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)));
      toast.success(editando === 'nuevo' ? `Rol "${rol.nombre}" creado` : 'Rol guardado', { id: 'roles' });
      setEditando(null);
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'roles' }); }
    finally { setGuardando(false); }
  };

  const borrar = async (rol: Rol) => {
    if (!window.confirm(`¿Borrar el rol "${rol.nombre}"?`)) return;
    try {
      const res = await http.borrar(urls.roles.uno(rol.id));
      if (!res.ok) { toast.error(res.error, { id: 'roles' }); return; }
      setRoles(prev => prev.filter(r => r.id !== rol.id));
      toast.success('Rol borrado', { id: 'roles' });
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'roles' }); }
  };

  return (
    <Section>
      <Toolbar>
        <SectionTitle count={roles.length}>Roles del personal</SectionTitle>
        <ToolbarActions>
          <Button size="sm" onClick={() => abrir('nuevo')} disabled={!catalogo.length}>+ Nuevo rol</Button>
        </ToolbarActions>
      </Toolbar>
      <p className="-mt-1 mb-4 text-[12.5px] text-muted-foreground">
        Crea un rol, márcale lo que puede hacer y asígnalo en <strong className="font-medium text-foreground">Usuarios</strong> a
        quien trabaja contigo. Lo que no tenga marcado no lo puede ver ni hacer, aunque lo intente por otro lado.
        Tú siempre puedes todo.
      </p>

      {fallo && <NoSePudoCargar que="los roles" onReintentar={cargar} />}
      {!fallo && !cargando && roles.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-[13px] text-muted-foreground">
          <ShieldCheck className="mx-auto mb-2 size-6 text-primary" />
          Todavía no hay roles. Empieza por uno, por ejemplo "Vendedor".
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {roles.map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-medium text-foreground">{r.nombre}</p>
                <p className="text-[12px] text-muted-foreground">
                  {r.personas === 0 ? 'Nadie lo tiene todavía' : `${r.personas} ${r.personas === 1 ? 'persona' : 'personas'}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8" title="Editar" onClick={() => abrir(r)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" className="size-8 hover:text-destructive" title="Borrar" onClick={() => borrar(r)}><Trash2 className="size-4" /></Button>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {r.permisos.length === 0
                ? <span className="text-[12px] text-muted-foreground">Sin permisos: no puede hacer nada</span>
                : r.permisos.map(p => (
                  <span key={p} className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] text-primary">{etiqueta(p)}</span>
                ))}
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={editando != null}
        onClose={() => setEditando(null)}
        title={editando === 'nuevo' ? 'Nuevo rol' : 'Editar rol'}
        onSubmit={guardar}
        submitLabel={guardando ? 'Guardando…' : 'Guardar'}
        loading={guardando}
        maxWidth={560}
      >
        <Field label="Nombre del rol *">
          <Input value={nombre} maxLength={50} required placeholder="Ej: Vendedor" onChange={e => setNombre(e.target.value)} />
        </Field>
        {grupos.map(([grupo, permisos]) => (
          <div key={grupo} className="space-y-1.5 border-t border-border pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{grupo}</p>
            {permisos.map(p => (
              <label key={p.clave} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1 hover:bg-secondary/50">
                <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={marcados.has(p.clave)} onChange={() => alternar(p.clave)} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] text-foreground">{p.etiqueta}</span>
                  {p.ayuda && <span className="block text-[12px] leading-snug text-muted-foreground">{p.ayuda}</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
      </Modal>
    </Section>
  );
}
