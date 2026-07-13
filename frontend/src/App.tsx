import { useLocation } from 'react-router-dom';
import { AuthProvider } from './application/context/AuthProvider';
import { CartProvider } from './application/context/CartProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';
import ScrollToTop from './router/ScrollToTop';
import CartDrawer from './components/CartDrawer';

function AppLayout() {
  const isDashboard = useLocation().pathname === '/dashboard';

  if (isDashboard) {
    return <AppRouter />;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex-1">
        <AppRouter />
      </div>
      <CartDrawer />
      <footer className="border-t border-border py-5 text-center text-[13px] text-muted-foreground">
        <span className="text-primary">✦</span> © {new Date().getFullYear()} Celestial Parfums. Todos los derechos reservados.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <ScrollToTop />
          <AppLayout />
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
