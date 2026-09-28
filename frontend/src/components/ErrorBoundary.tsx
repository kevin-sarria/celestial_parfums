import { Component, type ReactNode } from 'react';
import { borrarCopiasGuardadas, esErrorDeVersionVieja, recargarVersionNueva } from '../utils/versionNueva';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary]', error);
    // Una página de la versión anterior pidiendo archivos que ya no existen:
    // se arregla sola recargando (ver utils/versionNueva.ts)
    if (esErrorDeVersionVieja(error)) void recargarVersionNueva();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
          <h2 style={{ color: '#8b5cf6', fontSize: '1.5rem' }}>Algo salio mal</h2>
          <p style={{ color: '#666' }}>Ocurrio un error inesperado.</p>
          <button
            onClick={async () => {
              // Borra las copias guardadas antes de ir al inicio: si el fallo vino
              // de una versión vieja, volver sin borrarlas lo repetiría
              await borrarCopiasGuardadas();
              window.location.href = '/';
            }}
            style={{ padding: '10px 24px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
