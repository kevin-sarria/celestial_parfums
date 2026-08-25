import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import Modal from '../../../../components/Modal';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { hoy } from '../../../../utils/fechas';
import { formatPrice } from '../../helpers';
import { Field, FieldRow } from '../../ui';
import { mlDiluyente } from '../../../../application/costeoCotizacion';
import type { InventarioInsumo, Lookup } from '../../types';
import type { FormulaVolumen, Insumo } from '../../../../domain/entities/cotizacion.types';
import type { PerfumeLite } from './ProduccionModal';

interface Props {
  perfumes: PerfumeLite[];
  formulas: FormulaVolumen[];
  /** Catálogo de insumos, para proponer el costo con la receta del tamaño. */
  catalogo: Insumo[];
  insumos: InventarioInsumo[];
  onClose: () => void;
  onGuardado: () => void;
}

/** Insumo de la fórmula ubicado por nombre (mismo criterio del motor de costeo). */
const porNombre = (insumos: Insumo[], clave: string) =>
  insumos.find((i) => i.tipo === 'materia_prima'
    && i.nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(clave));

/**
 * FRASCOS QUE YA EXISTÍAN ANTES DEL SISTEMA.
 *
 * Producir descuenta material; esto NO. Nace de una barrera real: el dueño tenía
 * 5 frascos 1.1 armados hace semanas que no podía registrar por ningún camino,
 * porque el único que existía —registrar un lote— le habría descontado una
 * esencia que ya gastó y que además no contó al inventariar (contó solo el
 * líquido suelto). El aviso amarillo de abajo no es decorativo: es la diferencia
 * entre esta pantalla y "Armé perfumes", y hay que poder leerla sin saber nada
 * del sistema.
 */
export function CargaInicialArmados({ perfumes, formulas, catalogo, insumos, onClose, onGuardado }: Props) {
  const [presentaciones, setPresentaciones] = useState<Lookup[]>([]);
  const [perfumeId, setPerfumeId] = useState<number | ''>('');
  const [presentacionId, setPresentacionId] = useState<number | ''>('');
  const [unidades, setUnidades] = useState('1');
  const [costo, setCosto] = useState('');
  /** true en cuanto el dueño escribe el costo: desde ahí manda él, no el cálculo. */
  const [costoTocado, setCostoTocado] = useState(false);
  const [fecha, setFecha] = useState(hoy());
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    // Silencioso a propósito: si falla, el modal sigue sirviendo con la lista
    // vacía y el dueño ve que no hay tallas, en vez de un error que no puede
    // resolver.
    http.get<{ data: Lookup[] }>(urls.clasificaciones('presentaciones').lista)
      .then((r) => { if (r.ok && r.cuerpo?.data) setPresentaciones(r.cuerpo.data); });
  }, []);

  const perfume = perfumes.find((p) => p.id === perfumeId) ?? null;
  const presentacion = presentaciones.find((p) => p.id === presentacionId) ?? null;

  /**
   * Lo que costaría armar UNO hoy, como propuesta. Sale de la receta de ese
   * tamaño con los promedios de hoy —el mismo cálculo de "Armé perfumes"—, así
   * que es un punto de partida honesto, no un invento: el dueño lo corrige si
   * sus frascos le costaron otra cosa.
   */
  const costoSugerido = useMemo(() => {
    const ml = presentacion?.nombre?.match(/(\d+)/)?.[1];
    const formula = formulas.find((f) => String(f.ml_total) === ml);
    if (!formula) return null;

    const precio = (id: number | null | undefined) =>
      insumos.find((i) => i.id === id)?.costo_promedio ?? 0;
    const esenciaId = perfume?.insumo_esencia_id ?? formula.esencia_insumo_id;
    return Math.round(
      formula.esencia_ml * precio(esenciaId)
      + mlDiluyente(formula) * precio(porNombre(catalogo, 'diluyente')?.id)
      + Number(formula.sellador_ml) * precio(porNombre(catalogo, 'sellador')?.id)
      + Number(formula.feromonas_ml) * precio(porNombre(catalogo, 'feromonas')?.id)
      + precio(formula.envase_insumo_id),
    );
  }, [presentacion, formulas, perfume, insumos, catalogo]);

  useEffect(() => {
    if (!costoTocado && costoSugerido !== null) setCosto(String(costoSugerido));
  }, [costoSugerido, costoTocado]);

  const cantidad = Number(unidades) || 0;
  const total = cantidad * (Number(costo) || 0);

  const guardar = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!perfumeId || !presentacionId || cantidad <= 0) {
      toast.error('Elige el producto, la talla y cuántos frascos tienes', { id: 'carga-inicial' });
      return;
    }
    setGuardando(true);
    try {
      const res = await http.post(urls.inventario.cargaInicialArmados, {
        fecha,
        perfume_id: perfumeId,
        presentacion_id: presentacionId,
        cantidad,
        costo_unitario: Number(costo) || 0,
      });
      if (!res.ok) { toast.error(res.error, { id: 'carga-inicial' }); return; }
      toast.success(
        `Listo: ${cantidad} ${cantidad === 1 ? 'frasco' : 'frascos'} de ${perfume?.nombre ?? ''} `
        + 'entraron a tu inventario. No se descontó ningún material.',
      );
      onGuardado();
      onClose();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'carga-inicial' }); }
    finally { setGuardando(false); }
  };

  return (
    <Modal open onClose={onClose} title="Frascos que ya tienes armados"
      onSubmit={guardar} submitLabel={guardando ? 'Guardando…' : 'Agregar a mi inventario'} loading={guardando}>

      <p className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2 text-[12.5px] text-amber-800">
        Esto <strong>no descuenta esencia ni envases</strong>: es para los frascos que armaste
        antes, cuyo material ya salió de tu bodega. Si acabas de armarlos, usa
        <strong> Registrar uso → Armé perfumes</strong>, que sí descuenta la receta.
      </p>

      <Field label="¿De qué producto son?">
        <BuscadorSelect
          value={perfumeId}
          placeholder="— Elige el producto —"
          opciones={perfumes.map((p) => ({ id: p.id, nombre: p.nombre }))}
          onSelect={(id) => setPerfumeId(id === '' ? '' : Number(id))}
        />
      </Field>

      <FieldRow>
        <Field label="¿Qué talla?">
          <BuscadorSelect
            value={presentacionId}
            placeholder="— Elige la talla —"
            opciones={presentaciones.map((p) => ({ id: p.id, nombre: p.nombre }))}
            onSelect={(id) => setPresentacionId(id === '' ? '' : Number(id))}
          />
        </Field>
        <Field label="¿Cuántos frascos?">
          <Input type="number" min="1" value={unidades} onChange={(e) => setUnidades(e.target.value)} />
        </Field>
      </FieldRow>

      <FieldRow>
        <Field label="¿Qué te costó cada uno? (COP)">
          <Input
            type="number" min="0" value={costo}
            onChange={(e) => { setCosto(e.target.value); setCostoTocado(true); }}
          />
          {costoSugerido !== null && !costoTocado && (
            <p className="mt-1 text-[12px] text-muted-foreground">
              Calculado con la receta de esa talla y los precios de hoy. Corrígelo si te costó otra cosa.
            </p>
          )}
        </Field>
        <Field label="¿Cuándo los armaste?">
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
      </FieldRow>

      {cantidad > 0 && total > 0 && (
        <p className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-[12.5px]">
          Entran <strong>{cantidad}</strong> {cantidad === 1 ? 'frasco' : 'frascos'} por{' '}
          <strong className="text-primary">{formatPrice(total)}</strong> en producto listo para vender.
        </p>
      )}
    </Modal>
  );
}
