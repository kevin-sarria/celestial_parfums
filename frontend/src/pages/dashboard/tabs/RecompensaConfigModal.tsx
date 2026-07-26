import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogFooter } from '@/components/ui/dialog';
import Modal from '../../../components/Modal';
import TarjetaRecompensas3D from '../../../components/recompensas/TarjetaRecompensas3D';
import type { MiTarjeta } from '../../../application/hooks/useMiTarjeta';
import { Field, FieldRow, FormError, ColorField } from '../ui';
import type { RecompensaConfig } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  config: RecompensaConfig;
  onChange: (c: RecompensaConfig) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}

/**
 * Modal de configuración de la tarjeta de recompensas: parámetros (sellos,
 * premio, mínimo, activo) + colores, con una PREVISUALIZACIÓN en vivo de cómo
 * queda la tarjeta del cliente.
 */
export default function RecompensaConfigModal({ open, onClose, config, onChange, onSave, saving, error }: Props) {
  const set = <K extends keyof RecompensaConfig>(k: K, v: RecompensaConfig[K]) => onChange({ ...config, [k]: v });

  // Tarjeta de ejemplo para el preview (3 de N sellos, con los colores actuales)
  const preview: MiTarjeta = {
    activo: true,
    objetivo: Math.max(1, config.sellos_objetivo || 5),
    premio: config.premio || 'Tu premio',
    min_compra: config.min_compra || 0,
    sellos: Math.min(3, Math.max(1, (config.sellos_objetivo || 5) - 2)),
    faltan: Math.max(0, (config.sellos_objetivo || 5) - Math.min(3, Math.max(1, (config.sellos_objetivo || 5) - 2))),
    premio_listo: false,
    premios_listos: 0,
    premios_entregados: 0,
    sellos_historicos: 3,
    colores: { fondo: config.color_fondo, lineas: config.color_lineas, texto: config.color_texto },
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Configurar tarjeta de recompensas"
      maxWidth={860}
      footer={
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={onSave} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</Button>
        </DialogFooter>
      }
    >
      <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,340px)]">
        {/* ── Parámetros ── */}
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 text-[13.5px] font-medium text-foreground">
            <input type="checkbox" className="size-4 accent-primary"
              checked={config.activo} onChange={e => set('activo', e.target.checked)} />
            Programa activo (los clientes ven su tarjeta al iniciar sesión)
          </label>

          <FieldRow>
            <Field label="Sellos para ganar el premio *">
              <Input type="number" min="1" max="50" value={config.sellos_objetivo}
                onChange={e => set('sellos_objetivo', Number(e.target.value))} />
            </Field>
            <Field label="Compra mínima por sello (0 = cualquiera)">
              <Input type="number" min="0" value={config.min_compra}
                onChange={e => set('min_compra', Number(e.target.value))} />
            </Field>
          </FieldRow>
          <Field label="Premio al completar la tarjeta *">
            <Input value={config.premio} maxLength={200}
              placeholder="Ej: Un perfume de 10ml GRATIS"
              onChange={e => set('premio', e.target.value)} />
          </Field>

          <div className="pt-1">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Colores de la tarjeta</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ColorField label="Fondo" value={config.color_fondo} onChange={v => set('color_fondo', v)} />
              <ColorField label="Líneas y sellos" value={config.color_lineas} onChange={v => set('color_lineas', v)} />
              <ColorField label="Texto" value={config.color_texto} onChange={v => set('color_texto', v)} />
            </div>
          </div>

          <FormError>{error}</FormError>
        </div>

        {/* ── Previsualización en vivo ── */}
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Vista previa</p>
          <TarjetaRecompensas3D tarjeta={preview} nombre="Nombre Cliente" />
        </div>
      </div>
    </Modal>
  );
}
