import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { recargarVersionNueva } from './utils/versionNueva'

// Vite avisa con este evento cuando no pudo traer un archivo de la página: casi
// siempre es una pestaña de la versión anterior tras un despliegue (ver versionNueva.ts)
window.addEventListener('vite:preloadError', (evento) => {
  evento.preventDefault()
  void recargarVersionNueva()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
