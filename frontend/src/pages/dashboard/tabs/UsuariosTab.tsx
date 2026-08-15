import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { fmtInstante } from '../helpers';
import { http } from '../../../infrastructure/api/http';
import { urls } from '../../../infrastructure/api/urls';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError, BloqueCampos } from '../ui';
import { useAuthContext } from '../../../application/context/useAuthContext';
import type { Usuario, UsuarioForm } from '../types';

const emptyForm = (): UsuarioForm => ({
  nombre: '', apellido: '', email: '', activo: true, password: '',
  telefono: '', direccion: '',
});

/** El email sintético de las fichas no se muestra (no es un correo real). */
const esEmailSintetico = (email: string) => email.endsWith('@sin-cuenta.local');

export function UsuariosTab() {
  const { user: adminUser } = useAuthContext();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // editId null + open true = crear ficha nueva
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<UsuarioForm>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await http.get<{ data: Usuario[] }>(urls.usuarios.lista);
    setUsuarios(res.cuerpo?.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setForm(emptyForm()); setError('');
    setModal({ open: true, editId: null });
  };

  const openEdit = (u: Usuario) => {
    setForm({
      nombre: u.nombre, apellido: u.apellido,
      email: esEmailSintetico(u.email) ? '' : u.email,
      activo: u.activo, password: '',
      telefono: u.telefono ?? '', direccion: u.direccion ?? '',
    });
    setError('');
    setModal({ open: true, editId: u.id });
  };

  const editando = modal.editId != null ? usuarios.find(u => u.id === modal.editId) : null;

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      let res;
      if (modal.editId == null) {
        // Nueva ficha (persona sin cuenta web)
        res = await http.post(urls.usuarios.crear, {
          nombre: form.nombre.trim(), apellido: form.apellido.trim(),
          email: form.email.trim() || undefined,
          telefono: form.telefono.trim() || undefined,
          direccion: form.direccion.trim() || undefined,
        });
      } else {
        res = await http.patch(urls.usuarios.usuario(modal.editId), {
          nombre: form.nombre.trim(), apellido: form.apellido.trim(),
          // Ficha sin correo real: se conserva el sintético interno
          email: form.email.trim() || editando?.email,
          activo: form.activo,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
          telefono: form.telefono.trim() || null,
          direccion: form.direccion.trim() || null,
        });
      }
      if (!res.ok) { setError(res.error); return; }
      setModal({ open: false, editId: null });
      load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (u: Usuario) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} ${u.apellido}? Sus ventas quedan registradas (sin enlace); si tiene créditos no se podrá eliminar.`)) return;
    const res = await http.borrar(urls.usuarios.usuario(u.id));
    if (!res.ok) { toast.error(res.error, { id: 'usuarios' }); return; }
    load();
  };

  const columns: ColumnDef<Usuario>[] = [
    { key: 'usuario', header: 'Persona', type: 'string',
      getValue: u => `${u.nombre} ${u.apellido} ${esEmailSintetico(u.email) ? '' : u.email}`,
      render: u => (
        <span>
          {u.nombre} {u.apellido}
          {u.id === adminUser?.id && <span className="ml-1.5 text-[11px] font-semibold text-primary">(tú)</span>}
          <div className="text-[11px] font-normal text-muted-foreground">
            {esEmailSintetico(u.email) ? 'sin correo' : u.email}
          </div>
        </span>
      ),
      className: 'whitespace-nowrap font-medium text-foreground', movil: 'titulo' },
    { key: 'tipo', header: 'Tipo', type: 'enum', enumOptions: ['ADMIN', 'Cuenta web', 'Ficha'],
      getValue: u => (u.rol_id === 1 ? 'ADMIN' : u.sin_cuenta ? 'Ficha' : 'Cuenta web'),
      render: u => (
        <Badge
          variant="outline"
          className={
            u.rol_id === 1
              ? 'border-primary/40 bg-brand-soft text-primary'
              : u.sin_cuenta
                ? 'text-muted-foreground'
                : 'border-emerald-300 bg-emerald-50 text-emerald-600'
          }
        >
          {u.rol_id === 1 ? 'ADMIN' : u.sin_cuenta ? 'Ficha' : 'Cuenta web'}
        </Badge>
      ), noTruncate: true, movil: 'estado' },
    { key: 'activo', header: 'Estado', type: 'enum', enumOptions: ['activo', 'pendiente'],
      getValue: u => (u.activo ? 'activo' : 'pendiente'),
      render: u => u.sin_cuenta
        ? <span className="text-muted-foreground">—</span>
        : (
          <Badge variant="outline" className={u.activo ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-amber-300 bg-amber-50 text-amber-600'}>
            {u.activo ? 'Activo' : 'Pendiente'}
          </Badge>
        ), noTruncate: true, movil: 'estado' },
    { key: 'telefono', header: 'Telefono', type: 'string',
      getValue: u => u.telefono ?? '', render: u => u.telefono ?? '—',
      className: 'whitespace-nowrap text-muted-foreground', noTruncate: true },
    // Códigos de descuento emitidos y aún sin canjear (activos)
    { key: 'cupones', header: 'Descuentos por canjear', type: 'string',
      getValue: u => (u.codigos_activos ?? []).map(c => c.codigo).join(' '),
      render: u => (u.codigos_activos ?? []).length === 0
        ? <span className="text-muted-foreground">—</span>
        : (
          <div className="flex max-w-64 flex-wrap gap-1">
            {u.codigos_activos.map(c => (
              <Badge key={c.codigo} variant="outline"
                className="border-primary/40 bg-brand-soft font-mono text-[11px] text-primary"
                title={`${c.titulo} (-${c.descuento_pct}%)`}>
                🎟 {c.codigo} · -{c.descuento_pct}%
              </Badge>
            ))}
          </div>
        ),
      sortable: false, noTruncate: true },
    { key: 'created_at', header: 'Registrado', type: 'date',
      getValue: u => u.created_at.slice(0, 10), render: u => fmtInstante(u.created_at),
      className: 'whitespace-nowrap text-muted-foreground', noTruncate: true, movil: 'meta' },
  ];

  /** Mismas acciones en dos tamaños: icono en la fila, con texto en la tarjeta. */
  const accionesFila = (u: Usuario, conTexto: boolean) => (
    <>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto ? undefined : 'size-8 text-muted-foreground hover:text-foreground'}
        onClick={() => openEdit(u)}
        title="Editar"
      >
        <Pencil className="size-4" />{conTexto && ' Editar'}
      </Button>
      <Button
        variant={conTexto ? 'outline' : 'ghost'}
        size={conTexto ? 'sm' : 'icon'}
        className={conTexto
          ? 'text-destructive disabled:opacity-30'
          : 'size-8 text-muted-foreground hover:text-destructive disabled:opacity-30'}
        disabled={u.id === adminUser?.id}
        onClick={() => handleDelete(u)}
        title={u.id === adminUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
      >
        <Trash2 className="size-4" />{conTexto && ' Borrar'}
      </Button>
    </>
  );

  return (
    <>
      <Section>
        <Toolbar>
          <SectionTitle count={usuarios.length}>Usuarios</SectionTitle>
          <ToolbarActions>
            <Button size="sm" onClick={openCreate}>
              <UserPlus className="size-4" /> Nueva persona
            </Button>
          </ToolbarActions>
        </Toolbar>

        <SmartTable
          columns={columns}
          rows={usuarios}
          rowKey={u => u.id}
          numerada
          paginadoLocal
          tarjetaMovil
          emptyText="Aún no hay personas registradas"
          renderActions={u => accionesFila(u, false)}
          accionesMovil={u => accionesFila(u, true)}
        />
      </Section>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, editId: null })}
        title={modal.editId == null ? 'Nueva persona (sin cuenta web)' : 'Editar persona'}
        onSubmit={handleSubmit}
        submitLabel={loading ? 'Guardando...' : modal.editId == null ? 'Registrar' : 'Guardar cambios'}
        loading={loading}
      >
        <BloqueCampos titulo="Datos de contacto">
          <FieldRow>
            <Field label="Nombre *">
              <Input required maxLength={100} value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </Field>
            <Field label="Apellido *">
              <Input required maxLength={100} value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label={modal.editId == null || editando?.sin_cuenta ? 'Correo (si se registra con él, hereda su historial)' : 'Correo *'}>
              <Input type="email" maxLength={150} value={form.email}
                required={modal.editId != null && !editando?.sin_cuenta}
                placeholder={editando?.sin_cuenta || modal.editId == null ? 'Opcional' : ''}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Telefono">
              <Input maxLength={20} value={form.telefono}
                onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
            </Field>
          </FieldRow>
          <Field label="Direccion">
            <Input maxLength={255} value={form.direccion}
              onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </Field>
        </BloqueCampos>

        {/* Estado y contraseña solo aplican a cuentas web reales */}
        {modal.editId != null && !editando?.sin_cuenta && (
          <BloqueCampos titulo="Cuenta web" descripcion="Solo aplica a quien se registró en la página.">
            <Field label="Estado">
              <SelectSimple
                value={form.activo ? 'activo' : 'pendiente'}
                disabled={modal.editId === adminUser?.id}
                onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))}
              >
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente de verificar</option>
              </SelectSimple>
            </Field>
            <Field label="Nueva contraseña (dejar vacío para no cambiarla)">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="text" className="pl-9" minLength={6} maxLength={255} value={form.password}
                  placeholder="Mínimo 6 caracteres"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </Field>
          </BloqueCampos>
        )}

        {(modal.editId == null || editando?.sin_cuenta) && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Una ficha es una persona sin cuenta web (clientes de tu Excel). Si le pones su
            correo real, cuando se registre en la página con ese correo su cuenta quedará
            unida automáticamente a todas sus ventas y créditos.
          </p>
        )}
        <FormError>{error}</FormError>
      </Modal>
    </>
  );
}
