import { useEffect } from 'react';

const SITE = 'Celestial Parfums';

/**
 * SEO del lado cliente: título del documento, meta description y canonical de
 * la página actual (Google sí ejecuta JS; WhatsApp usa las etiquetas que el
 * servidor inyecta en /perfume/* y /combo/*).
 */
export function useSeo(titulo?: string | null, descripcion?: string | null) {
  useEffect(() => {
    if (titulo) document.title = titulo.includes(SITE) ? titulo : `${titulo} — ${SITE}`;
    if (descripcion) {
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', descripcion);
    }
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = window.location.origin + window.location.pathname;
  }, [titulo, descripcion]);
}
