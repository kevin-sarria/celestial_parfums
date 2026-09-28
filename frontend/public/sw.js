/**
 * v2 (2026-09-28): la v1 guardaba como "archivo de código" la página de inicio
 * que el servidor devuelve cuando un archivo ya no existe (después de cada
 * despliegue desaparecen los de la versión anterior). Esa copia mala quedaba
 * para siempre y el iPhone del dueño mostraba "Algo salió mal" sin arreglo.
 * Cambiar el nombre hace que `activate` borre la caché vieja en todos los
 * teléfonos la próxima vez que abran la tienda.
 */
const CACHE_NAME = 'celestial-parfums-v2';

/** Solo se guarda lo que de verdad es el archivo pedido, nunca una página HTML de relleno. */
const esGuardable = (res) => res.ok && !(res.headers.get('content-type') || '').includes('text/html');
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/icons.svg',
  '/offline.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API requests
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // Network-first for navigation (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      // `no-store`: el servidor no le dice al teléfono que no guarde el HTML, y
      // el iPhone reusaba la página VIEJA por horas (pedía archivos ya borrados)
      fetch(request, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|webp|svg|woff2?|ttf|eot)$/) ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (esGuardable(res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return res;
          }
          // Un archivo de código que llega como página HTML es un archivo que ya
          // no existe (versión vieja): se contesta 404 para que la página lo note
          // y se recargue, en vez de intentar ejecutar HTML
          if (res.ok) return new Response('', { status: 404, statusText: 'Archivo de una version anterior' });
          return res;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for images from uploads
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (esGuardable(res)) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
        return cached || fetchPromise;
      })
    );
    return;
  }
});
