import { useState } from 'react';
import { FlaskConical, PackageCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { http } from '../../../../infrastructure/api/http';
import { urls } from '../../../../infrastructure/api/urls';
import { useConsultaDeApoyo } from '../../../../application/hooks/useConsultaDeApoyo';
import { NoSePudoCargar } from '../../../../components/NoSePudoCargar';
import { formatPrice } from '../../helpers';
import { Section, SectionTitle } from '../../ui';
import { EnvasadoModal } from '../inventario/EnvasadoModal';
import type { Tanda } from '../inventario/tandas';
import type { InventarioInsumo } from '../../types';
import type { FormulaVolumen } from '../../../../domain/entities/cotizacion.types';
import type { PerfumeLite } from '../inventario/ProduccionModal';

/**
 * LO QUE ESTÁ REPOSANDO AHORA MISMO.
 *
 * Va arriba del histórico de lotes porque es lo único de esta pantalla sobre lo
 * que hay que **decidir algo**: cuál ya está listo para envasar. El histórico se
 * consulta; esto se atiende.
 *
 * El dato que manda es **cuántos días lleva**, no la fecha: el dueño elige por
 * ahí de cuál envasar, y con diez graneles en curso una lista de fechas obliga a
 * restar de cabeza diez veces.
 */

interface Props {
  formulas: FormulaVolumen[];
  perfumes: PerfumeLite[];
  insumos: InventarioInsumo[];
  /** Envasar y cerrar cambian el inventario: la pantalla entera se recarga. */
  onCambio: () => void;
}

export function MacerandoAhora({ formulas, perfumes, insumos, onCambio }: Props) {
  const [envasando, setEnvasando] = useState<number | null>(null);
  const { dato, fallo, cargando, recargar: cargar } =
    useConsultaDeApoyo<Tanda[]>(urls.inventario.maceraciones);
  const tandas = dato ?? [];

  const cerrar = async (t: Tanda) => {
    // Confirmar porque anota una PÉRDIDA: los ml que quedaban se dan por
    // perdidos y ya no se pueden envasar.
    const aviso = `¿Cerrar la tanda de ${t.perfume_nombre}?\n\n`
      + `Los ${t.saldo_ml} ml que quedan se anotan como merma `
      + `(${formatPrice(t.valor_saldo)}) y la tanda deja de aparecer aquí.`;
    if (!window.confirm(aviso)) return;
    const res = await http.post<{ message?: string }>(urls.inventario.cerrarMaceracion(t.id), {});
    if (!res.ok) { toast.error(res.error, { id: 'tanda' }); return; }
    toast.success(res.cuerpo?.message ?? 'Tanda cerrada');
    cargar();
    onCambio();
  };

  if (cargando) return null;

  /**
   * No poder preguntar no es lo mismo que no tener nada (regla del 2026-08-29).
   * Un `catch` mudo aquí escondería un servidor caído detrás de una pantalla que
   * se ve perfectamente normal.
   */
  if (fallo) {
    return <Section><NoSePudoCargar que="si tienes algo macerando" onReintentar={cargar} /></Section>;
  }

  if (!tandas.length) return null;

  return (
    <>
      <Section>
        <SectionTitle count={tandas.length}>Macerando ahora</SectionTitle>
        <p className="text-[12.5px] text-muted-foreground">
          Estas tandas ya gastaron su esencia y su diluyente. Al envasarlas{' '}
          <strong className="text-foreground">no se vuelve a descontar líquido</strong>: solo el
          envase y los accesorios.
        </p>

        <ul className="space-y-2">
          {tandas.map((t) => (
            <li key={t.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">
                  {t.perfume_nombre} · {t.saldo_ml} ml
                  {t.saldo_ml < 0 && (
                    <span className="ml-1.5 text-[11.5px] font-semibold text-destructive">
                      envasaste de más
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Desde {t.fecha} · <strong className="text-foreground">
                    lleva {t.dias} {t.dias === 1 ? 'día' : 'días'}
                  </strong>
                  {' · '}{formatPrice(t.costo_ml)} por ml
                  {t.listo_estimado && ` · lista el ${t.listo_estimado}`}
                  {t.envasados > 0 && ` · ${t.envasados} envasado${t.envasados === 1 ? '' : 's'}`}
                </p>
              </div>
              <Button size="sm" onClick={() => setEnvasando(t.id)}>
                <PackageCheck className="size-4" /> Envasar
              </Button>
              <Button size="sm" variant="outline" onClick={() => cerrar(t)}>
                <FlaskConical className="size-4" /> Cerrar tanda
              </Button>
            </li>
          ))}
        </ul>
      </Section>

      {envasando !== null && (
        <EnvasadoModal
          tandas={tandas}
          tandaInicial={envasando}
          formulas={formulas}
          perfumes={perfumes}
          insumos={insumos}
          onClose={() => setEnvasando(null)}
          onGuardado={() => { cargar(); onCambio(); }}
        />
      )}
    </>
  );
}
