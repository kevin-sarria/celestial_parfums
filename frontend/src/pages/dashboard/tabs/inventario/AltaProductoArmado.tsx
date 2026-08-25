import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field, FieldRow } from '../../ui';
import type { InventarioInsumo } from '../../types';

export interface ArmadoCreado { id: number; nombre: string }

interface Props {
  /** Lo que el dueño escribió en el buscador: el nombre llega escrito. */
  nombreInicial: string;
  /** Tallas del catálogo, para enganchar la que se arma. */
  presentaciones: { id: number; nombre: string }[];
  /** Envases del inventario, para elegir el premium. */
  envases: InventarioInsumo[];
  /** Esencias, para costear los que él prepara. */
  esencias: InventarioInsumo[];
  onCerrar: () => void;
  /** `seguir` = quedarse aquí para dar de alta otro. */
  onCreado: (creado: ArmadoCreado, seguir: boolean) => void;
}

/**
 * Dar de alta un 1.1 SIN salir de donde se está armando.
 *
 * Es el mismo patrón que `AltaInsumoEnCompra` (dar de alta un insumo sin salir
 * de la factura), traído aquí por una razón medida: el dueño tenía 5 frascos 1.1
 * sin ficha porque registrarlos obligaba a irse a otra pantalla y llenar 16
 * campos, doce de los cuales no le aplican a un 1.1. Textual (2026-08-25): *"es
 * una barrera grande"*.
 *
 * Pide CUATRO cosas, las mínimas para que el frasco tenga costo y precio. El
 * resto de la ficha —foto, notas, descripción— se llena luego desde Productos, y
 * mientras tanto no se ve en la tienda: nace apagado.
 */
export function AltaProductoArmado({
  nombreInicial, presentaciones, envases, esencias, onCerrar, onCreado,
}: Props) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [comprado, setComprado] = useState(false);
  const [presentacionId, setPresentacionId] = useState<number | ''>('');
  const [envaseId, setEnvaseId] = useState<number | ''>('');
  const [esenciaId, setEsenciaId] = useState<number | ''>('');
  const [precio, setPrecio] = useState('');
  const [guardando, setGuardando] = useState(false);

  const crear = async (seguir: boolean) => {
    if (!nombre.trim() || !(Number(precio) > 0) || !presentacionId) {
      toast.error('Ponle nombre, precio y la talla que armas', { id: 'armado' });
      return;
    }
    setGuardando(true);
    try {
      const res = await http.post<{ data: ArmadoCreado; message?: string }>(urls.perfumes.armado, {
        nombre: nombre.trim(),
        precio: Number(precio),
        presentacion_id: presentacionId,
        envase_insumo_id: envaseId || null,
        insumo_esencia_id: comprado ? null : (esenciaId || null),
        comprado,
      });
      if (!res.ok || !res.cuerpo?.data) { toast.error(res.error, { id: 'armado' }); return; }
      // El mensaje lo escribe el servidor: distingue "lo creé" de "ya lo tenías",
      // y esa diferencia es justo lo que el dueño necesita saber.
      toast.success(res.cuerpo.message ?? `"${res.cuerpo.data.nombre}" quedó creado, fuera de la tienda`);
      onCreado(res.cuerpo.data, seguir);
      if (seguir) {
        // Se limpia solo lo que cambia de un producto a otro: la talla y el
        // envase suelen repetirse en la misma tanda, y volver a elegirlos cinco
        // veces es justo la fricción que esta pantalla viene a quitar.
        setNombre(''); setPrecio(''); setEsenciaId('');
      }
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'armado' }); }
    finally { setGuardando(false); }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-brand-soft/30 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
        Producto nuevo
      </p>

      <FieldRow>
        <Field label="¿Cómo se llama?" className="min-w-52 flex-1">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Bon Bon 1.1" autoFocus />
        </Field>
        <Field label="¿A cuánto lo vendes? *" className="w-44">
          <Input type="number" min="0" value={precio}
            onChange={(e) => setPrecio(e.target.value)} placeholder="Ej: 150000" />
        </Field>
      </FieldRow>

      {/* La pregunta que decide si gasta TU esencia o no. */}
      <div className="mt-1 flex flex-wrap gap-3 text-[12.5px]">
        {[
          { valor: false, texto: 'Lo preparo yo' },
          { valor: true, texto: 'Lo compro ya hecho' },
        ].map((o) => (
          <label key={String(o.valor)} className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" className="size-4 accent-primary"
              checked={comprado === o.valor} onChange={() => setComprado(o.valor)} />
            {o.texto}
          </label>
        ))}
      </div>

      <FieldRow>
        <Field label="¿Qué talla armas?" className="w-48">
          <BuscadorSelect
            value={presentacionId}
            placeholder="— Elige la talla —"
            opciones={presentaciones.map((p) => ({ id: p.id, nombre: p.nombre }))}
            onSelect={(id) => setPresentacionId(id === '' ? '' : Number(id))}
          />
        </Field>
        <Field label="¿Qué envase lleva?" className="w-56">
          <BuscadorSelect
            value={envaseId}
            placeholder="— El de siempre —"
            opciones={envases.map((v) => ({ id: v.id, nombre: `${v.nombre} (${v.stock})` }))}
            onSelect={(id) => setEnvaseId(id === '' ? '' : Number(id))}
          />
        </Field>
        {!comprado && (
          <Field label="¿Con qué esencia?" className="w-52">
            <BuscadorSelect
              value={esenciaId}
              placeholder="— Sin asignar —"
              opciones={esencias.map((e) => ({ id: e.id, nombre: e.nombre }))}
              onSelect={(id) => setEsenciaId(id === '' ? '' : Number(id))}
            />
          </Field>
        )}
      </FieldRow>

      <p className="mt-1.5 text-[12px] text-muted-foreground">
        Nace <strong>fuera de la tienda</strong>. Le pones foto y descripción cuando quieras, y lo
        enciendes desde Productos.
      </p>

      <div className="mt-2.5 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={() => crear(false)} disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear y seguir'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => crear(true)} disabled={guardando}>
          Crear y añadir otro
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCerrar} disabled={guardando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
