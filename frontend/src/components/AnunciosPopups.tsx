import { BadgePercent } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAnuncios, type Anuncio } from '../application/hooks/useAnuncios';

/**
 * Cola de ventanas emergentes configuradas por el admin: se muestran una a una
 * (en su orden) al entrar a la página; al cerrar una aparece la siguiente.
 */
export default function AnunciosPopups() {
  const { pendientes, marcarVisto } = useAnuncios();
  const actual: Anuncio | undefined = pendientes[0];

  if (!actual) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && marcarVisto(actual)}>
      <DialogContent className="sm:max-w-md">
        {actual.tipo === 'imagen' ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-medium text-ink">{actual.titulo}</DialogTitle>
            </DialogHeader>
            {actual.imagen_url && (
              <img src={actual.imagen_url} alt={actual.titulo} className="max-h-105 w-full rounded-xl object-contain" />
            )}
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-medium text-ink">{actual.titulo}</DialogTitle>
            </DialogHeader>

            {actual.imagen_url && (
              <img src={actual.imagen_url} alt={actual.titulo} className="max-h-56 w-full rounded-xl object-contain" />
            )}

            {actual.tipo === 'descuento' && (
              <div className="flex items-center gap-3 rounded-xl bg-brand-soft px-4 py-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <BadgePercent className="size-5" />
                </span>
                <div>
                  <p className="font-display text-2xl font-medium text-primary">-{actual.descuento_pct}%</p>
                  <p className="text-[12.5px] text-muted-foreground">
                    En {[...actual.categorias, ...(actual.aplica_combos ? ['combos'] : [])].join(', ')}
                    {actual.min_unidades > 0 &&
                      ` · comprando ${actual.min_unidades} ${actual.min_unidades === 1 ? 'unidad' : 'unidades'} o más`}
                    {actual.min_monto > 0 &&
                      ` · en compras desde $${actual.min_monto.toLocaleString('es-CO')}`}
                    {' '}· se aplica solo en tu carrito
                  </p>
                </div>
              </div>
            )}

            {actual.mensaje && (
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-muted-foreground">{actual.mensaje}</p>
            )}
          </>
        )}

        <Button className="w-full rounded-full" onClick={() => marcarVisto(actual)}>
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}
