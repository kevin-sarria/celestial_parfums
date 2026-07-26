import type { FormEvent } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  onSubmit: () => void;
  onVerCatalogo: () => void;
}

/**
 * Hero de la landing: lujo minimalista (aire, tipografía display, cero cajas).
 * Golpea el valor (huele al original por menos) y ofrece UNA acción clara: el
 * buscador (con ejemplos de intención real) que lleva al catálogo.
 */
export default function LandingHero({ search, onSearchChange, onSubmit, onVerCatalogo }: Props) {
  const submit = (e: FormEvent) => { e.preventDefault(); onSubmit(); };
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pb-6 pt-16 text-center md:pt-24 animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-primary">Perfumería · Esencias premium</p>
      <h1 className="mx-auto mt-6 max-w-2xl font-display text-[2.6rem] font-light leading-[1.06] tracking-tight text-ink md:text-[3.75rem]">
        Las fragancias que amas, <em className="italic text-primary">sin pagar de más</em>
      </h1>
      <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
        Contratipos de alta calidad, 1.1 y originales. Elige la tuya y pídela por WhatsApp.
      </p>

      <form className="relative mx-auto mt-9 max-w-lg" onSubmit={submit}>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          placeholder="Busca tu perfume favorito (ej: Sauvage, 212…)"
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-12 rounded-full border-border bg-card pl-11 pr-24 text-base shadow-none transition-shadow duration-300 focus-visible:shadow-[0_10px_34px_-16px_rgb(0_0_0/0.2)] md:text-[15px]"
        />
        <Button type="submit" size="sm" className="absolute right-1.5 top-1/2 h-9 -translate-y-1/2 rounded-full px-4">
          Buscar
        </Button>
      </form>

      <button
        type="button"
        onClick={onVerCatalogo}
        className="group mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        o explora todo el catálogo
        <span className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
      </button>
    </section>
  );
}
