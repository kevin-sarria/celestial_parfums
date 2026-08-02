import { useEffect, useState } from 'react';

/**
 * true mientras la media query se cumpla.
 * Lo usan el paginador compacto (520px) y la vista de tarjeta (639px).
 */
export function useMediaQuery(query: string): boolean {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setCoincide(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return coincide;
}
