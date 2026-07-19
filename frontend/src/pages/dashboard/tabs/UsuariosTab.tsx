import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Trash2, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import Modal from '../../../components/Modal';
import { SmartTable } from '../../../components/table/SmartTable';
import type { ColumnDef } from '../../../components/table/tableTypes';
import { API_USUARIOS, fmtDate } from '../helpers';
import { Section, SectionTitle, Toolbar, ToolbarActions, Field, FieldRow, FormError } from '../ui';
import { useAuthContext } from '../../../application/context/useAuthContext';
import type { GuardedFetch, Usuario, UsuarioForm } from '../types';

interface UsuariosTabProps {
  guardedFetch: GuardedFetch;
}

const emptyForm = (): UsuarioForm => ({
  nombre: '', apellido: '', email: '', activo: true, password: '',
  telefono: '', direccion: '',
});

/** El email sintético de las fichas no se muestra (no es un correo real). */
const esEmailSintetico = (email: string) => email.endsWith('@sin-cuenta.local');

export function UsuariosTab({ guardedFetch }: UsuariosTabProps) {
  const { user: adminUser } = useAuthContext();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // editId null + open true = crear ficha nueva
  const [modal, setModal] = useState<{ open: boolean; editId: number | null }>({ open: false, editId: null });
  const [form, setForm] = useState<UsuarioForm>(emptyForm());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const res = await guardedFetch(API_USUARIOS);
    const json = await res.json();
    setUsuarios(json.data ?? []);
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
        res = await guardedFetch(API_USUARIOS, {
          method: 'POST',
          body: JSON.stringify({
            nombre: form.nombre.trim(), apellido: form.apellido.trim(),
            email: form.email.trim() || undefined,
            telefono: form.telefono.trim() || undefined,
            direccion: form.direccion.trim() || undefined,
          }),
        });
      } else {
        res = await guardedFetch(`${API_USUARIOS}/${modal.editId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            nombre: form.nombre.trim(), apellido: form.apellido.trim(),
            // Ficha sin correo real: se conserva el sintético interno
            email: form.email.trim() || editando?.email,
            activo: form.activo,
            ...(form.password.trim() ? { password: form.password.trim() } : {}),
            telefono: form.telefono.trim() || null,
            direccion: form.direccion.trim() || null,
          }),
        });
      }
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Error al guardar'); return; }
      setModal({ open: false, editId: null });
      load();
    } catch { setError('No se pudo conectar con el servidor'); }
    finally { setLoading(false); }
  };

  const handleDelete = async (u: Usuario) => {
    if (!window.confirm(`¿Eliminar a ${u.nombre} ${u.apellido}? Sus ventas quedan registradas (sin enlace); si tiene créditos no se podrá eliminar.`)) return;
    const res = await guardedFetch(`${API_USUARIOS}/${u.id}`, { method: 'DELETE' });
    if (!res.ok) { const j = await res.json(); alert(j.error ?? 'Error al eliminar'); return; }
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
      className: 'whitespace-nowrap font-medium text-foreground' },
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
      ), noTruncate: true },
    { key: 'activo', header: 'Estado', type: 'enum', enumOptions: ['activo', 'pendiente'],
      getValue: u => (u.activo ? 'activo' : 'pendiente'),
      render: u => u.sin_cuenta
        ? <span className="text-muted-foreground">—</span>
        : (
          <Badge variant="outline" className={u.activo ? 'border-emerald-300 bg-emerald-50 text-emerald-600' : 'border-amber-300 bg-amber-50 text-amber-600'}>
            {u.activo ? 'Activo' : 'Pendiente'}
          </Badge>
        ), noTruncate: true },
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
      getValue: u => u.created_at.slice(0, 10), render: u => fmtDate(u.created_at),
      className: 'whitespace-nowrap text-muted-foreground', noTruncate: true },
  ];

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
          emptyText="Aún no hay personas registradas"
          renderActions={u => (
            <>
              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-foreground" onClick={() => openEdit(u)} title="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost" size="icon"
                className="size-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                disabled={u.id === adminUser?.id}
                onClick={() => handleDelete(u)}
                title={u.id === adminUser?.id ? 'No puedes eliminar tu propia cuenta' : 'Eliminar'}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
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

        {/* Estado y contraseña solo aplican a cuentas web reales */}
        {modal.editId != null && !editando?.sin_cuenta && (
          <>
            <Field label="Estado">
              <NativeSelect
                value={form.activo ? 'activo' : 'pendiente'}
                disabled={modal.editId === adminUser?.id}
                onChange={e => setForm(f => ({ ...f, activo: e.target.value === 'activo' }))}
              >
                <option value="activo">Activo</option>
                <option value="pendiente">Pendiente de verificar</option>
              </NativeSelect>
            </Field>
            <Field label="Nueva contraseña (dejar vacío para no cambiarla)">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="text" className="pl-9" minLength={6} maxLength={255} value={form.password}
                  placeholder="Mínimo 6 caracteres"
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            </Field>
          </>
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
