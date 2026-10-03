import { useEffect, useState } from 'react';
import { Bell, Heart, ShoppingBag, Sparkles, Star, type LucideIcon } from 'lucide-react';
import { formatPrice } from '@/lib/format';
import { http } from '../../infrastructure/api/http';
import { urls } from '../../infrastructure/api/urls';

interface Programa { activo: boolean; sellos_objetivo: number; premio: string; min_compra: number }

/**
 * Lo que se gana con una cuenta, debajo del login y del registro
 * (2026-10-02, segunda tanda de la revisión).
 *
 * Antes la caja pedía correo y contraseña sin decir para qué: quien no sabía
 * que había sellos, favoritos y avisos no veía motivo para crearla. Los sellos
 * solo se anuncian si el programa está encendido y con el premio que el dueño
 * configuró: si lo apaga, aquí desaparecen (nada de promesas que no se cumplen).
 */
export function BeneficiosCuenta({ titulo }: { titulo: string }) {
  const [programa, setPrograma] = useState<Programa | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await http.get<{ data: Programa }>(urls.recompensas.programa, { sesionOpcional: true });
        setPrograma(res.cuerpo?.data ?? null);
      } catch { /* sin el dato, simplemente no se anuncian los sellos */ }
    })();
  }, []);

  const lista: { icono: LucideIcon; texto: string }[] = [
    ...(programa?.activo
      ? [{ icono: Star, texto: `Tarjeta de sellos: con ${programa.sellos_objetivo} compras${programa.min_compra > 0 ? ` desde ${formatPrice(programa.min_compra)}` : ''}, ${programa.premio.charAt(0).toLowerCase()}${programa.premio.slice(1)}` }]
      : []),
    { icono: Heart, texto: 'Guarda tus perfumes favoritos' },
    { icono: Bell, texto: 'Te avisamos cuando vuelva lo que está agotado' },
    { icono: Sparkles, texto: 'Descubre tu perfume ideal con un test corto' },
    { icono: ShoppingBag, texto: 'Tus compras a mano, para reseñarlas' },
  ];

  return (
    <div className="mt-5 rounded-2xl border border-border/70 bg-brand-soft/30 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">{titulo}</p>
      <ul className="mt-2.5 space-y-2">
        {lista.map(({ icono: Icono, texto }) => (
          <li key={texto} className="flex items-start gap-2.5 text-[13px] leading-snug text-foreground">
            <Icono className="mt-0.5 size-3.5 shrink-0 text-primary" />
            {texto}
          </li>
        ))}
      </ul>
    </div>
  );
}
