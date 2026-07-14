import { useLocation } from 'react-router-dom';
import { AuthProvider } from './application/context/AuthProvider';
import { CartProvider } from './application/context/CartProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';
import ScrollToTop from './router/ScrollToTop';
import CartDrawer from './components/CartDrawer';
import { BrandMark } from './components/BrandMark';

function AppLayout() {
  const { pathname } = useLocation();
  // Rutas a pantalla completa: sin footer ni chrome del catálogo
  const isFullBleed = pathname === '/dashboard' || pathname === '/contactame';

  if (isFullBleed) {
    return <AppRouter />;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex-1">
        <AppRouter />
      </div>
      <CartDrawer />
      <footer className="flex items-center justify-center gap-1.5 border-t border-border py-5 text-center text-[13px] text-muted-foreground">
        <BrandMark className="size-5" /> © {new Date().getFullYear()} Celestial Parfums. Todos los derechos reservados.
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
