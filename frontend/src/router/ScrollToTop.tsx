import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/** Lleva la ventana al inicio cada vez que cambia la ruta (ej. al abrir el detalle de un producto). */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
