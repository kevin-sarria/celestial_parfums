import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';

interface AuthCardProps {
  subtitle?: string;
  children: ReactNode;
}

/** Layout centrado de las páginas de autenticación con la marca arriba. */
export function AuthCard({ subtitle, children }: AuthCardProps) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-7 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 font-display text-[26px] font-medium tracking-wide text-foreground transition-opacity hover:opacity-80"
          >
            <BrandMark className="size-9" />
            Celestial Parfums
          </Link>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] sm:p-7">
          {children}
        </div>
        <div className="mt-5 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Volver a la tienda
          </Link>
        </div>
      </div>
    </div>
  );
}
