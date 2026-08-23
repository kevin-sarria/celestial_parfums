import type { FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../../components/Modal';
import { RED_OPTIONS } from '../../../../components/contacto/redIcons';
import { Field, FieldRow, FormError, ColorField } from '../../ui';
import type { ContactoForma } from '../../../../domain/entities/contacto.schema';

/** Lo que se teclea al crear o editar un link de la página Contáctame. */
export interface LinkForm {
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

/**
 * Crear o editar un link. Salió de `RedesTab.tsx` (iba en 665 líneas), donde
 * eran 129 líneas de JSX al final del `return`, tan lejos de su estado que
 * había que hacer scroll para saber qué campo tocaba qué.
 *
 * Recibe el formulario y una sola función para cambiarlo: quien lo abre sigue
 * siendo el dueño del estado, que es lo que permite que "Nuevo" y "Editar"
 * sean el mismo modal con distinto punto de partida.
 */
export function ModalEnlace({ abierto, editando, form, cambiar, onGuardar, onCerrar, guardando, error }: {
  abierto: boolean;
  editando: boolean;
  form: LinkForm;
  cambiar: <K extends keyof LinkForm>(clave: K, valor: LinkForm[K]) => void;
  onGuardar: (e: FormEvent<HTMLFormElement>) => void;
  onCerrar: () => void;
  guardando: boolean;
  error: string;
}) {
  return (
      <Modal
        open={abierto}
        onClose={onCerrar}
        title={editando ? 'Editar link' : 'Nuevo link'}
        onSubmit={onGuardar}
        submitLabel={editando ? 'Guardar cambios' : 'Crear link'}
        loading={guardando}
        maxWidth={520}
      >
        <FormError>{error}</FormError>

        <Field label="Tipo">
          <SelectSimple
            value={form.tipo}
            onChange={e => {
              const tipo = e.target.value as 'boton' | 'red';
              // Cada tipo tiene su icono por defecto: botón sin icono, red con el de su plataforma
              cambiar('tipo', tipo);
              cambiar('iconoTipo', tipo === 'red' ? 'red' : 'ninguno');
            }}
          >
            <option value="boton">Botón de link</option>
            <option value="red">Icono de red social</option>
          </SelectSimple>
        </Field>

        {form.tipo === 'boton' ? (
          <>
            <Field label="Nombre a mostrar">
              <Input required value={form.nombre} maxLength={100}
                placeholder="Ej: Catálogo de perfumes"
                onChange={e => cambiar('nombre', e.target.value)} />
            </Field>
            <FieldRow>
              <Field label="Icono del botón">
                <SelectSimple
                  value={form.iconoTipo}
                  onChange={e => cambiar('iconoTipo', e.target.value as LinkForm['iconoTipo'])}
                >
                  <option value="ninguno">Sin icono</option>
                  <option value="emoji">Emoji o texto</option>
                  <option value="red">Icono de red social</option>
                </SelectSimple>
              </Field>
              {form.iconoTipo === 'emoji' && (
                <Field label="Emoji o texto">
                  <Input value={form.emoji} maxLength={8} placeholder="Ej: ✨"
                    onChange={e => cambiar('emoji', e.target.value)} />
                </Field>
              )}
              {form.iconoTipo === 'red' && (
                <Field label="Red social">
                  <SelectSimple value={form.iconoRed} onChange={e => cambiar('iconoRed', e.target.value)}>
                    {RED_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </SelectSimple>
                </Field>
              )}
            </FieldRow>
          </>
        ) : (
          <FieldRow>
            <Field label="Plataforma">
              <SelectSimple value={form.plataforma} onChange={e => cambiar('plataforma', e.target.value)}>
                {RED_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </SelectSimple>
            </Field>
            <Field label="Contenido del círculo">
              <div className="flex gap-2">
                <SelectSimple
                  value={form.iconoTipo === 'emoji' ? 'emoji' : 'red'}
                  onChange={e => cambiar('iconoTipo', e.target.value as LinkForm['iconoTipo'])}
                >
                  <option value="red">Icono de la plataforma</option>
                  <option value="emoji">Emoji o letras</option>
                </SelectSimple>
                {form.iconoTipo === 'emoji' && (
                  <Input value={form.emoji} maxLength={8} placeholder="Ej: KD"
                    className="max-w-24"
                    onChange={e => cambiar('emoji', e.target.value)} />
                )}
              </div>
            </Field>
          </FieldRow>
        )}

        <Field label="Link (URL)">
          <Input required type="url" value={form.url} placeholder="https://..."
            onChange={e => cambiar('url', e.target.value)} />
        </Field>

        {form.tipo === 'boton' && (
          <div className="space-y-3 rounded-xl border border-border bg-secondary/40 p-3.5">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-foreground">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={form.usarGlobal}
                onChange={e => cambiar('usarGlobal', e.target.checked)}
              />
              Usar el estilo global de botones
            </label>
            {!form.usarGlobal && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Forma">
                  <SelectSimple value={form.forma} onChange={e => cambiar('forma', e.target.value as ContactoForma)}>
                    <option value="redondo">Bordes redondos</option>
                    <option value="cuadrado">Cuadrado</option>
                  </SelectSimple>
                </Field>
                <ColorField label="Color del botón" value={form.color_fondo} onChange={v => cambiar('color_fondo', v)} />
                <ColorField label="Color del texto" value={form.color_texto} onChange={v => cambiar('color_texto', v)} />
              </div>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={form.activo}
            onChange={e => cambiar('activo', e.target.checked)}
          />
          Visible en la página
        </label>
      </Modal>
  );
}
