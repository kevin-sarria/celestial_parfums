import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface CatalogHeroProps {
  kicker?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  searchValue: string;
  searchPlaceholder: string;
  onSearchChange: (value: string) => void;
}

/** Encabezado editorial de las páginas del catálogo: kicker + título display + búsqueda. */
export default function CatalogHero({
  kicker = 'Perfumería · Esencias premium',
  title,
  subtitle,
  searchValue,
  searchPlaceholder,
  onSearchChange,
}: CatalogHeroProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 pb-8 pt-12 text-center md:px-8 md:pt-16 animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">{kicker}</p>
      <h1 className="mx-auto mt-3 max-w-2xl font-display text-4xl font-light tracking-tight text-ink md:text-[3.4rem] md:leading-[1.08]">
        {title}
      </h1>
      {subtitle && (
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      <div className="relative mx-auto mt-7 max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchValue}
          placeholder={searchPlaceholder}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 rounded-full border-border bg-card pl-11 pr-5 text-sm shadow-none transition-shadow duration-300 focus-visible:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.2)]"
        />
      </div>
    </section>
  );
}
