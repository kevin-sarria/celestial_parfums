import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { hoy } from '../../../../utils/fechas';
import { formatPrice } from '../../helpers';
import { opcionesPorExistencias } from '../../../../domain/entities/insumo';
import { Field, FieldRow } from '../../ui';
import type { InventarioInsumo } from '../../types';
import type { FormulaVolumen } from '../../../../domain/entities/cotizacion.types';
import type { PerfumeLite } from './ProduccionModal';
import type { Tanda } from './tandas';

/**
 * ENVASAR: la segunda mitad de producir.
 *
 * Saca ml de una tanda que ya reposó y los mete en frascos. Gasta el envase y
 * los accesorios de la receta; **no vuelve a gastar esencia**, porque esa salió
 * de la bodega el día de la mezcla.
 *
 * De la misma tanda se puede envasar varias veces y **en tallas distintas**
 * (3 × 30 ml hoy, 2 × 100 ml la semana que viene): por eso la talla y la
 * cantidad se preguntan aquí y no al macerar.
 */

interface Props {
  tandas: Tanda[];
  /** Tanda preseleccionada cuando se entra desde su fila en Producciones. */
  tandaInicial?: number | null;
  formulas: FormulaVolumen[];
  perfumes: PerfumeLite[];
  insumos: InventarioInsumo[];
  onClose: () => void;
  onGuardado: () => void;
}

export function EnvasadoModal({
  tandas, tandaInicial = null, formulas, perfumes, insumos, onClose, onGuardado,
}: Props) {
  const primera = tandas[0];
  const [tandaId, setTandaId] = useState<number | ''>(tandaInicial ?? primera?.id ?? '');
  const tanda = tandas.find((t) => t.id === tandaId) ?? null;

  const [fecha, setFecha] = useState(hoy());
  const [formulaId, setFormulaId] = useState<number | ''>(formulas[0]?.id ?? '');
  const [cantidad, setCantidad] = useState('1');
  // De qué producto son estos frascos: arranca en la fragancia de la tanda, que
  // es lo normal, pero se puede cambiar (de un granel salen normales y 1.1).
  const [perfumeId, setPerfumeId] = useState<number | ''>(tanda?.perfume_id ?? '');
  const [envaseId, setEnvaseId] = useState<number | ''>('');
  const [guardando, setGuardando] = useState(false);

  const formula = formulas.find((f) => f.id === formulaId) ?? null;
  const unidades = Math.max(0, Number(cantidad) || 0);
  const mlQueSalen = Number(formula?.ml_total ?? 0) * unidades;
  const saldoDespues = tanda ? Math.round((tanda.saldo_ml - mlQueSalen) * 1000) / 1000 : 0;

  const envases = insumos.filter((i) => i.tipo === 'envase');
  const envaseElegido = envases.find((i) => i.id === envaseId);
  const accesoriosDeLaReceta = 0; // el servidor los suma; aquí solo se estima el envase
  const costoPorFrasco = tanda
    ? tanda.costo_ml * Number(formula?.ml_total ?? 0)
      + Number(envaseElegido?.costo_promedio ?? 0) + accesoriosDeLaReceta
    : 0;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tandaId) { toast.error('Elige de qué granel estás envasando', { id: 'envasar' }); return; }
    if (!formulaId) { toast.error('Elige la talla que envasaste', { id: 'envasar' }); return; }
    if (!perfumeId) { toast.error('Elige de qué producto son estos frascos', { id: 'envasar' }); return; }
    if (unidades < 1) { toast.error('Dinos cuántos frascos envasaste', { id: 'envasar' }); return; }

    setGuardando(true);
    try {
      const res = await http.post<{ message?: string }>(urls.inventario.envasar(Number(tandaId)), {
        fecha,
        formula_volumen_id: formulaId,
        cantidad: unidades,
        perfume_id: perfumeId,
        envase_insumo_id: envaseId || null,
      });
      if (!res.ok) { toast.error(res.error, { id: 'envasar' }); return; }
      // El servidor avisa si el saldo quedó negativo; ese texto manda sobre uno
      // genérico, porque dice el número exacto.
      toast.success(res.cuerpo?.message ?? 'Frascos envasados');
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'envasar' }); }
    finally { setGuardando(false); }
  };

  if (!tandas.length) {
    return (
      <Modal open onClose={onClose} title="Envasé frascos" onSubmit={(e) => { e.preventDefault(); onClose(); }}
        submitLabel="Entendido">
        <p className="text-[13px] text-muted-foreground">
          No tienes nada macerando ahora mismo. Usa{' '}
          <strong className="text-foreground">Registrar uso → Puse a macerar</strong> para empezar
          una tanda, o <strong className="text-foreground">Armé directo</strong> si preparaste y
          envasaste el mismo día.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Envasé frascos" onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Envasar'} loading={guardando} maxWidth={620}>
      <FieldRow>
        <Field label="¿De cuál granel?">
          <BuscadorSelect
            value={tandaId}
            placeholder="— Elige la tanda —"
            opciones={tandas.map((t) => ({
              id: t.id as number | string,
              nombre: `${t.perfume_nombre} · ${t.saldo_ml} ml`,
              nota: `lleva ${t.dias} ${t.dias === 1 ? 'día' : 'días'}`,
            }))}
            onSelect={(id) => {
              const elegida = tandas.find((t) => t.id === Number(id));
              setTandaId(id === '' ? '' : Number(id));
              // El producto se propone solo: casi siempre es la misma fragancia.
              if (elegida) setPerfumeId(elegida.perfume_id);
            }}
          />
        </Field>
        <Field label="Día que envasaste">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="¿Qué talla?">
          <SelectSimple value={formulaId} onChange={(e) => setFormulaId(Number(e.target.value) || '')}>
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </SelectSimple>
        </Field>
        <Field label="¿Cuántos frascos?">
          <Input type="number" min="1" step="1" value={cantidad}
            onChange={(e) => setCantidad(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="¿Qué envase usaste?">
          {/* Los que están en cero salen al final y en gris, no escondidos:
              registrar un envasado de la semana pasada es legítimo. */}
          <BuscadorSelect
            value={envaseId}
            placeholder="— El del tamaño —"
            opciones={opcionesPorExistencias(envases.map((i) => ({
              id: i.id, nombre: i.nombre, stock: i.stock, activo: i.activo,
            })))}
            onSelect={(id) => setEnvaseId(id === '' ? '' : Number(id))}
          />
        </Field>
        <Field label="¿De qué producto son?">
          <BuscadorSelect
            value={perfumeId}
            placeholder="— Elige el producto —"
            opciones={perfumes.map((p) => ({ id: p.id as number | string, nombre: p.nombre }))}
            onSelect={(id) => setPerfumeId(id === '' ? '' : Number(id))}
          />
        </Field>
      </FieldRow>

      {tanda && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[12.5px]">
          <p>
            Saca <strong className="text-foreground">{mlQueSalen} ml</strong> de los{' '}
            {tanda.saldo_ml} que quedan →{' '}
            <strong className={saldoDespues < 0 ? 'text-destructive' : 'text-foreground'}>
              quedan {saldoDespues} ml
            </strong>
          </p>
          <p className="mt-0.5 text-muted-foreground">
            Cada frasco te queda en aproximadamente{' '}
            <strong className="text-foreground">{formatPrice(costoPorFrasco)}</strong>
            {' '}(el sistema le suma los accesorios de la receta al guardar).
          </p>
          {saldoDespues < 0 && (
            <p className="mt-1 font-medium text-destructive">
              Estás envasando más de lo que hay. Se registra igual y el saldo queda en negativo.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
