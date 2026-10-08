import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { recargarVersionNueva } from './utils/versionNueva'
import { clienteConsultas } from './infrastructure/api/consultas'

// Vite avisa con este evento cuando no pudo traer un archivo de la página: casi
// siempre es una pestaña de la versión anterior tras un despliegue (ver versionNueva.ts)
window.addEventListener('vite:preloadError', (evento) => {
  evento.preventDefault()
  void recargarVersionNueva()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteConsultas}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
