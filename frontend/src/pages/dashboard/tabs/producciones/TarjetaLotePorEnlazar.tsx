import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BuscadorSelect from '../../../../components/BuscadorSelect';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { Field } from '../../ui';
import type { LotePorEnlazar } from './LotesPorEnlazar';

interface Props {
  lote: LotePorEnlazar;
  /** Fichas que ya existen, para el camino de abajo. */
  perfumes: { id: number; nombre: string }[];
  /** Se resolvió: recargar el aviso y la tabla. */
  onResuelto: () => void;
}

/**
 * Una tarjeta del aviso: qué le pasa al lote y las dos formas de arreglarlo.
 *
 * El camino PRINCIPAL crea la ficha 1.1 que falta, porque es el caso real: el
 * dueño tiene 229 perfumes y CERO fichas 1.1, así que pedirle que eligiera una
 * ficha existente le dejaba un desplegable vacío y un aviso inútil (dicho por
 * él el 2026-08-25, viendo los seis lotes en producción).
 *
 * El nombre se propone —"Khamrah By Lattafa 1.1"— y se puede corregir antes de
 * crear: decisión suya, para que cada ficha nazca llamándose como él quiere.
 *
 * Es un componente aparte y no una función dentro del padre: cada tarjeta tiene
 * su propio nombre a medio escribir, y un componente declarado dentro de otro se
 * vuelve a montar en cada render y se lleva por delante lo que se estaba
 * tecleando.
 */
export function TarjetaLotePorEnlazar({ lote, perfumes, onResuelto }: Props) {
  const [nombre, setNombre] = useState(`${lote.perfume_nombre ?? ''} 1.1`.trim());
  const [destino, setDestino] = useState<number | ''>(lote.ficha_sugerida?.id ?? '');
  const [enviando, setEnviando] = useState(false);

  const crearFicha = async () => {
    if (!nombre.trim()) { toast.error('Ponle un nombre a la ficha', { id: 'enlazar' }); return; }
    setEnviando(true);
    try {
      const res = await http.post<{ message?: string }>(urls.inventario.fichaDeLote(lote.id), {
        nombre: nombre.trim(),
      });
      if (!res.ok) { toast.error(res.error, { id: 'enlazar' }); return; }
      toast.success(res.cuerpo?.message ?? 'Ficha creada con sus frascos');
      onResuelto();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'enlazar' }); }
    finally { setEnviando(false); }
  };

  const enlazarAExistente = async () => {
    if (!destino) { toast.error('Elige a qué ficha van estos frascos', { id: 'enlazar' }); return; }
    setEnviando(true);
    try {
      const res = await http.post<{ message?: string }>(urls.inventario.enlazarLote(lote.id), {
        perfume_id: destino,
      });
      if (!res.ok) { toast.error(res.error, { id: 'enlazar' }); return; }
      toast.success(res.cuerpo?.message ?? 'Listo: esos frascos ya están en su ficha');
      onResuelto();
    } catch { toast.error('No se pudo conectar con el servidor', { id: 'enlazar' }); }
    finally { setEnviando(false); }
  };

  return (
    <li className="rounded-lg border border-amber-400/45 bg-amber-400/10 px-3 py-2.5">
      <p className="text-[13px] font-medium text-foreground">
        Lote {lote.id} · {lote.fecha} · {lote.perfume_nombre} · {lote.volumen_nombre} ·{' '}
        {lote.cantidad} {lote.cantidad === 1 ? 'unidad' : 'unidades'}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
        {lote.motivo === 'sin_frascos'
          ? `Lo armaste con "${lote.envase_nombre}", pero estos frascos no están en el sistema: el lote es anterior al libro de frascos armados.`
          : `Gastó "${lote.envase_nombre}", pero sus frascos quedaron en la ficha del perfume corriente. Si alguien compra el normal, se le entrega este frasco.`}
      </p>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <Field label="Nombre de la ficha 1.1" className="w-64">
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Field>
        <Button size="sm" className="mb-0.5" onClick={crearFicha} disabled={enviando}>
          Crear su ficha 1.1 y traer los frascos
        </Button>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Se copia la ficha de <strong>{lote.perfume_nombre}</strong> —foto, descripción, notas,
        género y duración— marcada como 1.1 y con su envase. Nace{' '}
        <strong>fuera de la tienda</strong>, en Productos, para que la termines cuando quieras.
      </p>

      <details className="mt-2">
        <summary className="cursor-pointer text-[12px] text-muted-foreground hover:text-foreground">
          O mandarlos a una ficha que ya existe
        </summary>
        <div className="mt-1.5 flex flex-wrap items-end gap-2">
          <div className="w-64">
            <BuscadorSelect
              value={destino}
              placeholder="— ¿A qué ficha van? —"
              /* La ficha propuesta va SIEMPRE en la lista, aunque el catálogo
                 del dashboard —que se sirve cacheado— todavía no la traiga. */
              opciones={[
                ...(lote.ficha_sugerida && !perfumes.some((p) => p.id === lote.ficha_sugerida!.id)
                  ? [{ id: lote.ficha_sugerida.id as number | string, nombre: lote.ficha_sugerida.nombre }]
                  : []),
                ...perfumes.map((p) => ({ id: p.id as number | string, nombre: p.nombre })),
              ]}
              onSelect={(id) => setDestino(id === '' ? '' : Number(id))}
            />
          </div>
          <Button size="sm" variant="outline" onClick={enlazarAExistente} disabled={enviando}>
            Enlazar a esa ficha
          </Button>
        </div>
      </details>
    </li>
  );
}
