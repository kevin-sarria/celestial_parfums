import type { ReactNode } from 'react';

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
          <h1 className="font-display text-[26px] font-medium tracking-wide text-foreground">
            <span className="text-primary">✦</span> Celestial Parfums
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.12)] sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
