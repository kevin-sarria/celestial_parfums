import { TIPOS_ALTA, type TipoAlta } from './tipoDeProducto';

interface Props {
  onElegir: (tipo: TipoAlta) => void;
}

/**
 * La primera pregunta, que decide el formulario entero.
 *
 * Va como pantalla y no como un campo más porque es la que gobierna a las demás:
 * hasta el 2026-08-25 vivía en la casilla once y, para dar de alta una bolsa de
 * organza, había que pasar por su duración y su proyección. El dueño lo dijo
 * así: *"en base a cómo se consigue el producto, desde esa pregunta fundamental
 * es el tipo de modal que se debe renderizar"*.
 */
export function SelectorTipoProducto({ onElegir }: Props) {
  return (
    <div>
      <p className="text-[13.5px] text-muted-foreground">
        Elige qué es: cada uno pide solo lo suyo.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {TIPOS_ALTA.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onElegir(t.id)}
            className="flex items-start gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/50 hover:bg-brand-soft/40"
          >
            <span className="text-[20px] leading-none" aria-hidden>{t.emoji}</span>
            <span>
              <span className="block text-[13.5px] font-medium text-foreground">{t.titulo}</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">{t.detalle}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
