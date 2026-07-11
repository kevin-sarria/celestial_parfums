import { useLocation } from 'react-router-dom';
import { AuthProvider } from './application/context/AuthProvider';
import { CartProvider } from './application/context/CartProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';
import CartDrawer from './components/CartDrawer';

function AppLayout() {
  const isDashboard = useLocation().pathname === '/dashboard';

  if (isDashboard) {
    return <AppRouter />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <div style={{ flex: 1 }}>
        <AppRouter />
      </div>
      <CartDrawer />
      <footer style={{
        textAlign: 'center',
        padding: '1rem',
        fontSize: '0.85rem',
        color: '#888',
        borderTop: '1px solid #e5e7eb',
      }}>
        © {new Date().getFullYear()} Celestial Parfums. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <AppLayout />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
