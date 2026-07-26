import { useLocation } from 'react-router-dom';
import { AuthProvider } from './application/context/AuthProvider';
import { CartProvider } from './application/context/CartProvider';
import { ListasProvider } from './application/context/ListasProvider';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';
import ScrollToTop from './router/ScrollToTop';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';

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
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ListasProvider>
          <CartProvider>
            <ScrollToTop />
            <AppLayout />
          </CartProvider>
        </ListasProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
