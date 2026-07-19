import { useEffect } from 'react';

const SITE = 'Celestial Parfums';
const DESC_DEFECTO =
  'Celestial Parfums — Perfumería con esencias premium. Descubre fragancias para dama, caballero y unisex.';

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
    // Al salir de la página se restauran los valores por defecto: si la
    // siguiente ruta no llama a useSeo (login, dashboard…), el título del
    // producto anterior se quedaría pegado en la pestaña.
    return () => {
      document.title = SITE;
      document.querySelector('meta[name="description"]')?.setAttribute('content', DESC_DEFECTO);
    };
  }, [titulo, descripcion]);
}
