import { useLocation } from 'react-router-dom';
import { AuthProvider } from './application/context/AuthProvider';
import { CartProvider } from './application/context/CartProvider';
import { ListasProvider } from './application/context/ListasProvider';
import { Toaster } from '@/components/ui/sonner';
import ErrorBoundary from './components/ErrorBoundary';
import AppRouter from './router/AppRouter';
import ScrollToTop from './router/ScrollToTop';
import CartDrawer from './components/CartDrawer';
import Footer from './components/Footer';

function AppLayout() {
  const { pathname } = useLocation();
  // Rutas a pantalla completa: sin footer ni chrome del catálogo.
  // Ojo con `startsWith`: la pestaña vive en la URL (/dashboard/ventas), así que
  // comparar por igualdad exacta dejaba el footer público colgando debajo de
  // TODAS las pestañas del dashboard menos la raíz.
  const isFullBleed = pathname === '/dashboard' || pathname.startsWith('/dashboard/') || pathname === '/contactame';

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
            {/* Único punto de montaje de los avisos: sirve a toda la app,
                dashboard incluido (se avisa con `toast` de sonner). */}
            <Toaster />
          </CartProvider>
        </ListasProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
