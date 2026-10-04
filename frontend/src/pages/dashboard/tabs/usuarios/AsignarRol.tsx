import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../../components/Modal';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field } from '../../ui';

export interface RolPersonal { id: number; nombre: string }

const CLIENTE = 2;

/**
 * Cambiar el rol de una persona: cliente o uno del personal (2026-10-04).
 * Solo para quien tiene cuenta para entrar: una ficha sin correo no puede
 * iniciar sesión, así que darle un rol no serviría de nada (el servidor
 * también lo rechaza).
 */
export function AsignarRol({ persona, roles, onCerrar, onCambiado }: {
  persona: { id: number; nombre: string; apellido: string; rol_id: number } | null;
  roles: RolPersonal[];
  onCerrar: () => void;
  onCambiado: (id: number, rolId: number) => void;
}) {
  const [rol, setRol] = useState(CLIENTE);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (persona) setRol(persona.rol_id); }, [persona]);

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!persona) return;
    setGuardando(true);
    try {
      const res = await http.patch(urls.usuarios.rol(persona.id), { rol_id: rol });
      if (!res.ok) { toast.error(res.error, { id: 'rol' }); return; }
      onCambiado(persona.id, rol);
      toast.success(rol === CLIENTE
        ? `${persona.nombre} ya no entra al panel`
        : `${persona.nombre} ahora es ${roles.find(r => r.id === rol)?.nombre}. Verá el panel la próxima vez que entre.`, { id: 'rol' });
      onCerrar();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'rol' }); }
    finally { setGuardando(false); }
  };

  return (
    <Modal
      open={persona != null}
      onClose={onCerrar}
      title={persona ? `Rol de ${persona.nombre} ${persona.apellido}` : 'Rol'}
      onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Guardar'}
      loading={guardando}
      maxWidth={440}
    >
      <Field label="¿Qué es en tu negocio?">
        <SelectSimple value={String(rol)} onChange={e => setRol(Number(e.target.value))}>
          <option value={CLIENTE}>Cliente (no entra al panel)</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </SelectSimple>
      </Field>
      {roles.length === 0 && (
        <p className="text-[12.5px] text-muted-foreground">Primero crea un rol en Ajustes → Roles del personal.</p>
      )}
    </Modal>
  );
}
