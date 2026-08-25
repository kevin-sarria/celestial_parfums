import { hoy } from '../../../../utils/fechas';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { SelectSimple } from '@/components/ui/select-simple';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { formatPrice } from '../../helpers';
import { Field, FieldRow } from '../../ui';
import { mlDiluyente } from '../../../../application/costeoCotizacion';
import { opcionesPorExistencias } from '../../../../domain/entities/insumo';
import type { InventarioInsumo } from '../../types';
import type { FormulaVolumen, Insumo } from '../../../../domain/entities/cotizacion.types';
import { AltaProductoArmado } from './AltaProductoArmado';

/** Lo mínimo que hace falta del catálogo para elegir qué fragancia se armó. */
export interface PerfumeLite { id: number; nombre: string; insumo_esencia_id: number | null }

/** Insumo de la fórmula ubicado por nombre (mismo criterio del motor de costeo). */
const porNombre = (insumos: Insumo[], clave: string) =>
  insumos.find((i) => i.tipo === 'materia_prima'
    && i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(clave));

interface Props {
  formulas: FormulaVolumen[];
  perfumes: PerfumeLite[];
  /** Catálogo de insumos, para ubicar diluyente/sellador/feromonas por nombre. */
  catalogo: Insumo[];
  /** Existencias y costo, para calcular el costo del lote y avisar si no alcanza. */
  insumos: InventarioInsumo[];
  onClose: () => void;
  onGuardado: () => void;
}

/**
 * Registrar un lote armado.
 *
 * El FRONTEND calcula qué se consume, con el mismo motor puro de las
 * cotizaciones, y lo manda; el backend valida y aplica. Así la fórmula no se
 * reimplementa en dos lenguajes.
 */
export function ProduccionModal({
  formulas, perfumes, catalogo, insumos, onClose, onGuardado,
}: Props) {
  const [formulaId, setFormulaId] = useState<number | ''>(formulas[0]?.id ?? '');
  const [unidades, setUnidades] = useState('10');
  const [perfumeId, setPerfumeId] = useState<number | ''>('');
  const [envaseId, setEnvaseId] = useState<number | ''>('');
  const [guardando, setGuardando] = useState(false);
  /** Nombre tecleado cuando se elige "+ Crear …": el alta arranca con él escrito. */
  const [altaNombre, setAltaNombre] = useState<string | null>(null);
  const [presentaciones, setPresentaciones] = useState<{ id: number; nombre: string }[]>([]);
  /** Sube al crear un producto: refresca la lista sin recargar la página. */
  const [creados, setCreados] = useState<PerfumeLite[]>([]);

  useEffect(() => {
    // Las tallas solo hacen falta para el alta rápida; si la petición falla, el
    // registro del lote sigue funcionando igual y no tiene sentido alarmar.
    http.get<{ data: { id: number; nombre: string }[] }>(urls.clasificaciones('presentaciones').lista)
      .then((r) => { if (r.ok && r.cuerpo?.data) setPresentaciones(r.cuerpo.data); });
  }, []);

  const catalogoPerfumes = [...creados, ...perfumes];

  const perfumeElegido = perfumes.find((p) => p.id === perfumeId) ?? null;
  /**
   * El mismo tamaño puede llevar el envase normal o el luxury.
   *
   * Salen del INVENTARIO y no del catálogo de costeo porque aquí se van a
   * consumir: hace falta saber cuántos quedan para no ofrecer como disponible
   * uno que está en cero.
   */
  const envases = opcionesPorExistencias(insumos.filter((i) => i.tipo === 'envase'));

  /**
   * Qué consume un lote. La esencia sale del PERFUME elegido (cada fragancia
   * tiene la suya, con su propio costo); solo si el perfume no la tiene
   * asignada se cae a la esencia por defecto del tamaño.
   */
  const consumosDelLote = (f: FormulaVolumen, cant: number) => {
    const lista: { insumo_id: number; cantidad: number }[] = [];
    const suma = (id: number | null | undefined, porUnidad: number) => {
      if (id && porUnidad > 0) lista.push({ insumo_id: id, cantidad: Math.round(porUnidad * cant * 1000) / 1000 });
    };
    const esenciaId = perfumeElegido?.insumo_esencia_id
      ?? f.esencia_insumo_id ?? porNombre(catalogo, 'esencia')?.id;
    suma(esenciaId, f.esencia_ml);
    suma(porNombre(catalogo, 'diluyente')?.id, mlDiluyente(f));
    suma(porNombre(catalogo, 'sellador')?.id, f.sellador_ml);
    suma(porNombre(catalogo, 'feromonas')?.id, f.feromonas_ml);
    suma(envaseId || f.envase_insumo_id, 1);
    (f.accesorios_default ?? []).forEach((a) => suma(a.insumo_id, 1));
    return lista;
  };

  const formulaElegida = formulas.find((f) => f.id === formulaId) ?? null;
  const cant = Number(unidades) || 0;
  const consumos = formulaElegida && cant > 0 ? consumosDelLote(formulaElegida, cant) : [];
  /** El costo sale de los consumos reales, no del costo genérico del tamaño. */
  const costoLote = consumos.reduce((s, c) => {
    const inv = insumos.find((i) => i.id === c.insumo_id);
    return s + (inv?.costo_promedio ?? 0) * c.cantidad;
  }, 0);
  /** Insumos que no alcanzan: mejor avisar antes de dejar el stock negativo. */
  const faltantes = consumos
    .map((c) => ({ c, inv: insumos.find((i) => i.id === c.insumo_id) }))
    .filter((x) => x.inv && x.inv.stock < x.c.cantidad)
    .map((x) => `${x.inv!.nombre} (tienes ${x.inv!.stock}, necesitas ${x.c.cantidad})`);

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!formulaElegida || cant <= 0 || consumos.length === 0) {
      toast.error('Elige el tamaño y cuántas unidades armaste', { id: 'prod' }); return;
    }
    setGuardando(true);
    try {
      const res = await http.post<{ data?: { costo_total?: number } }>(urls.inventario.producciones, {
        fecha: hoy(),
        formula_volumen_id: formulaElegida.id, cantidad: cant, consumos,
        perfume_id: perfumeId || null,
        envase_insumo_id: envaseId || formulaElegida.envase_insumo_id || null,
      });
      if (!res.ok) { toast.error(res.error, { id: 'prod' }); return; }
      const json = res.cuerpo;
      // Se dice dónde quedó la plata Y dónde quedaron los frascos. Lo segundo
      // importa desde que el producto terminado existe: el material sale del
      // inventario y **no desaparece**, se convierte en frascos que se ven
      // arriba en esta misma pantalla y que al venderse ya no descuentan receta.
      toast.success(
        perfumeId
          ? `Listo: ${cant} ${cant === 1 ? 'frasco armado' : 'frascos armados'} · `
            + `${formatPrice(json?.data?.costo_total ?? 0)} de material. Los ves arriba, en "Frascos ya armados".`
          : `Lote registrado: ${formatPrice(json?.data?.costo_total ?? 0)} en insumos. `
            + 'Sin fragancia no se suman frascos: solo se descontó el material.',
      );
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'prod' }); }
    finally { setGuardando(false); }
  };

  return (
    <Modal open onClose={onClose} title="Registrar producción"
      onSubmit={guardar} submitLabel={guardando ? 'Guardando…' : 'Registrar lote'} loading={guardando}>
      {/* La fragancia decide qué esencia se descuenta: cada una cuesta distinto */}
      <Field label="¿Qué fragancia armaste?">
        <BuscadorSelect
          value={perfumeId}
          placeholder="— Elige el perfume —"
          opciones={[
            // "Crear nuevo" va PRIMERO: al final de una lista larga hay que hacer
            // scroll para encontrarlo y nadie descubre que la opción existe. Misma
            // decisión que en el alta de insumos desde la factura.
            { id: 'nuevo', nombre: '+ Crear producto nuevo (un 1.1 que armas)' },
            { id: '', nombre: '— Sin especificar (usa la esencia del tamaño) —' },
            ...catalogoPerfumes.map((p) => ({
              id: p.id as number | string,
              nombre: p.insumo_esencia_id ? p.nombre : `${p.nombre} · sin esencia asignada`,
            })),
          ]}
          onSelect={(id) => {
            if (id === 'nuevo') { setAltaNombre(''); return; }
            setPerfumeId(id === '' ? '' : Number(id));
          }}
          // Sin esto la lista tapa el formulario de alta que aparece debajo.
          cierranPanel={['nuevo']}
        />

        {altaNombre !== null && (
          <div className="mt-2">
            <AltaProductoArmado
              nombreInicial={altaNombre}
              presentaciones={presentaciones}
              envases={insumos.filter((i) => i.tipo === 'envase')}
              esencias={insumos.filter((i) => i.tipo === 'materia_prima')}
              onCerrar={() => setAltaNombre(null)}
              onCreado={(creado, seguir) => {
                // Entra a la lista y queda elegido: el dueño sigue con su lote
                // sin buscarlo de nuevo.
                setCreados((prev) => [{ id: creado.id, nombre: creado.nombre, insumo_esencia_id: null }, ...prev]);
                setPerfumeId(creado.id);
                if (!seguir) setAltaNombre(null);
              }}
            />
          </div>
        )}
        {perfumeElegido && !perfumeElegido.insumo_esencia_id && (
          <p className="mt-1 text-[12px] font-medium text-amber-700">
            Este perfume no tiene esencia asignada: se descontará la del tamaño y el costo
            será aproximado. Asígnasela en su ficha del catálogo.
          </p>
        )}
      </Field>

      <FieldRow>
        <Field label="¿Qué tamaño armaste?">
          <SelectSimple value={formulaId} onChange={(e) => setFormulaId(Number(e.target.value))}>
            {formulas.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
          </SelectSimple>
        </Field>
        <Field label="¿Cuántas unidades?">
          <Input type="number" min="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} />
        </Field>
      </FieldRow>

      <Field label="Envase usado">
        <BuscadorSelect
          value={envaseId || formulaElegida?.envase_insumo_id || ''}
          placeholder="— El del tamaño —"
          opciones={[{ id: '', nombre: '— El del tamaño —' }, ...envases]}
          onSelect={(id) => setEnvaseId(Number(id) || '')}
        />
        <p className="mt-1 text-[12px] text-muted-foreground">
          El mismo tamaño puede llevar el envase normal o el luxury; cámbialo si usaste otro.
          Los que están en cero salen al final: se pueden elegir igual —para registrar un lote de
          hace días— pero el stock quedará en negativo.
        </p>
      </Field>

      {consumos.length > 0 && (
        <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Se descontará del inventario
          </p>
          <ul className="mt-1.5 space-y-1 text-[12.5px]">
            {consumos.map((c) => {
              const inv = insumos.find((i) => i.id === c.insumo_id);
              return (
                <li key={c.insumo_id} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{inv?.nombre ?? `Insumo ${c.insumo_id}`}</span>
                  <span className="tabular-nums text-foreground">
                    {c.cantidad} {inv?.unidad ?? ''}
                    <span className="ml-1.5 text-muted-foreground">(quedan {((inv?.stock ?? 0) - c.cantidad).toFixed(1)})</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 border-t border-border/70 pt-1.5 text-[12.5px]">
            Costo del lote: <strong className="text-primary">{formatPrice(costoLote)}</strong>
          </p>
        </div>
      )}

      {faltantes.length > 0 && (
        <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] font-medium text-amber-700">
          No te alcanza para este lote: {faltantes.join(' · ')}. Puedes registrarlo igual, pero
          el stock quedará en negativo.
        </p>
      )}
    </Modal>
  );
}
