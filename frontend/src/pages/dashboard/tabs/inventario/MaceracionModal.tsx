import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { hoy } from '../../../../utils/fechas';
import { formatPrice } from '../../helpers';
import { Field, FieldRow } from '../../ui';
import type { FormulaVolumen } from '../../../../domain/entities/cotizacion.types';
import type { PerfumeLite } from './ProduccionModal';

/**
 * PONER A MACERAR: la primera mitad de producir.
 *
 * Lo que hace distinto a este modal del de armar: **no pide envase**. Los
 * envases se gastan al envasar, semanas después — que es justo lo que el sistema
 * viejo hacía mal, dejando 5 frascos "usados" que seguían vacíos en la repisa.
 *
 * La cuenta de lo que se va a descontar **la hace el servidor** (`vista-previa`)
 * y aquí solo se pinta. Es al revés que en `ProduccionModal`, que la calcula en
 * el navegador, y a propósito: aquí la proporción se ESCALA a los ml de la
 * tanda, y esa regla ya vive en el backend. Dos implementaciones de la misma
 * escala acabarían dando dos costos distintos para el mismo frasco.
 */

interface LineaPrevia {
  insumo_id: number;
  nombre: string;
  cantidad: number;
  unidad: string;
  costo: number;
  restante: number;
}

interface Previa {
  lineas: LineaPrevia[];
  costo_total: number;
  costo_ml: number;
}

interface Props {
  formulas: FormulaVolumen[];
  perfumes: PerfumeLite[];
  onClose: () => void;
  onGuardado: () => void;
}

export function MaceracionModal({ formulas, perfumes, onClose, onGuardado }: Props) {
  const [fecha, setFecha] = useState(hoy());
  const [perfumeId, setPerfumeId] = useState<number | ''>('');
  const [formulaId, setFormulaId] = useState<number | ''>(formulas[0]?.id ?? '');
  const [ml, setMl] = useState('500');
  const [listo, setListo] = useState('');
  const [nota, setNota] = useState('');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [guardando, setGuardando] = useState(false);

  const mlNum = Number(ml) || 0;

  useEffect(() => {
    if (!perfumeId || !formulaId || mlNum <= 0) { setPrevia(null); return; }
    let vigente = true;
    // Se pregunta al servidor con lo que hay escrito; si falla, no se pinta la
    // cuenta y el botón sigue disponible: el servidor valida igual al guardar.
    http.get<{ data: Previa }>(
      `${urls.inventario.vistaPreviaMaceracion}?formula_volumen_id=${formulaId}&perfume_id=${perfumeId}&ml=${mlNum}`,
    ).then((r) => { if (vigente) setPrevia(r.ok ? r.cuerpo?.data ?? null : null); });
    return () => { vigente = false; };
  }, [perfumeId, formulaId, mlNum]);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!perfumeId) { toast.error('Elige qué fragancia estás macerando', { id: 'macerar' }); return; }
    if (!formulaId) { toast.error('Elige la proporción de referencia', { id: 'macerar' }); return; }
    if (mlNum <= 0) { toast.error('Dinos cuántos ml preparaste', { id: 'macerar' }); return; }

    setGuardando(true);
    try {
      const res = await http.post<{ message?: string }>(urls.inventario.maceraciones, {
        fecha,
        perfume_id: perfumeId,
        formula_volumen_id: formulaId,
        ml: mlNum,
        listo_estimado: listo || null,
        nota: nota.trim() || null,
      });
      if (!res.ok) { toast.error(res.error, { id: 'macerar' }); return; }
      toast.success(res.cuerpo?.message ?? 'Puesto a macerar');
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'macerar' }); }
    finally { setGuardando(false); }
  };

  /** Alguno quedaría en negativo: se avisa y se deja pasar, como en el resto. */
  const faltantes = (previa?.lineas ?? []).filter((l) => l.restante < 0);

  return (
    <Modal open onClose={onClose} title="Puse a macerar" onSubmit={guardar}
      submitLabel={guardando ? 'Guardando…' : 'Poner a macerar'} loading={guardando} maxWidth={620}>
      <p className="text-[12.5px] text-muted-foreground">
        Esto gasta la esencia y el diluyente, y <strong className="text-foreground">no toca los
        envases</strong>: esos se gastan cuando envases los frascos, semanas después.
      </p>

      <FieldRow>
        <Field label="¿Qué fragancia?">
          <BuscadorSelect
            value={perfumeId}
            placeholder="— Elige la fragancia —"
            opciones={perfumes.map((p) => ({ id: p.id as number | string, nombre: p.nombre }))}
            onSelect={(id) => setPerfumeId(id === '' ? '' : Number(id))}
          />
        </Field>
        <Field label="¿Cuántos ml preparaste?">
          <Input type="number" min="1" step="1" value={ml} onChange={(e) => setMl(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="Proporción de referencia">
          <SelectSimple value={formulaId} onChange={(e) => setFormulaId(Number(e.target.value) || '')}>
            {formulas.map((f) => (
              <option key={f.id} value={f.id}>{f.nombre}</option>
            ))}
          </SelectSimple>
        </Field>
        <Field label="Día que la preparaste">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="¿Cuándo estará lista? (opcional)">
          <Input type="date" value={listo} onChange={(e) => setListo(e.target.value)} />
        </Field>
        <Field label="Nota (opcional)">
          <Input value={nota} maxLength={255} onChange={(e) => setNota(e.target.value)} />
        </Field>
      </FieldRow>

      {/* La cuenta ANTES de confirmar: macerar saca de la bodega el material más
          caro que hay, y a ciegas es donde se equivoca cualquiera. */}
      {previa && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[12.5px]">
          <p className="mb-1 font-medium text-foreground">Se va a descontar</p>
          <ul className="space-y-0.5">
            {previa.lineas.map((l) => (
              <li key={l.insumo_id} className="flex flex-wrap justify-between gap-2">
                <span className={l.restante < 0 ? 'text-destructive' : 'text-muted-foreground'}>
                  {l.nombre} · {l.cantidad} {l.unidad}
                  {l.restante < 0 && ` (quedaría en ${l.restante})`}
                </span>
                <span className="text-muted-foreground">{formatPrice(l.costo)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 border-t border-border pt-1.5 font-medium text-foreground">
            Costo de la tanda: {formatPrice(previa.costo_total)}
            {' → '}
            {formatPrice(previa.costo_ml)} por ml
          </p>
        </div>
      )}

      {faltantes.length > 0 && (
        <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-800">
          No te alcanza para {faltantes.length === 1 ? 'un material' : `${faltantes.length} materiales`}.
          Se registra igual y quedan en negativo, para que lo cuadres cuando puedas.
        </p>
      )}
    </Modal>
  );
}
