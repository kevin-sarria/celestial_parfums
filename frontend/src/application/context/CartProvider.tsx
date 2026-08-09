import { useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CartContext, type CartItem } from './CartContext';
import { useAuthContext } from './useAuthContext';
import { avisarAgregado } from '../../components/avisoAgregado';
import { cerrarRecordatorio } from '../carritoRecordatorio';

const STORAGE_KEY = 'celestial_cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: CartItem[] = raw ? JSON.parse(raw) : [];
    // Carritos guardados antes del campo `descuento`: se asume 0
    return items.map((i) => ({ ...i, descuento: i.descuento ?? 0 }));
  } catch { return []; }
}

function saveCart(items: CartItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthContext();
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  // El carrito se vacía SOLO al cerrar sesión (transición usuario→null), no al
  // entrar como visitante: los carritos anónimos deben sobrevivir la recarga.
  const prevUser = useRef(user);
  useEffect(() => {
    if (prevUser.current && !user) {
      setItems([]);
      localStorage.removeItem(STORAGE_KEY);
      setIsOpen(false);
    }
    prevUser.current = user;
  }, [user]);

  const persist = (next: CartItem[]) => { setItems(next); saveCart(next); };

  const addItem = useCallback((item: Omit<CartItem, 'id'>) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.productoId === item.productoId && i.esCombo === item.esCombo
          && i.presentacion === item.presentacion && i.tipo === item.tipo
      );
      let next: CartItem[];
      if (existing) {
        next = prev.map(i => i.id === existing.id ? { ...i, cantidad: i.cantidad + item.cantidad } : i);
      } else {
        const id = `${item.esCombo ? 'c' : 'p'}-${item.productoId}-${item.presentacion}-${item.tipo}-${Date.now()}`;
        next = [...prev, { ...item, id }];
      }
      saveCart(next);
      return next;
    });
    // NO se abre el carrito. Lo pidió un cliente real: abrir y cerrar el panel
    // en cada producto cansa y corta el impulso de seguir comprando. Basta un
    // aviso pequeño que confirme que sí quedó, con la foto para reconocerlo.
    avisarAgregado(item);
    // Y a quien acaba de agregar no hay que recordarle que tiene un pedido.
    cerrarRecordatorio();
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => { const next = prev.filter(i => i.id !== id); saveCart(next); return next; });
  }, []);

  const updateQuantity = useCallback((id: string, cantidad: number) => {
    if (cantidad < 1) return;
    setItems(prev => { const next = prev.map(i => i.id === id ? { ...i, cantidad } : i); saveCart(next); return next; });
  }, []);

  const clearCart = useCallback(() => { persist([]); }, []);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.cantidad, 0), [items]);

  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  return (
    <CartContext.Provider value={{ items, totalItems, addItem, removeItem, updateQuantity, clearCart, isOpen, openCart, closeCart }}>
      {children}
    </CartContext.Provider>
  );
}
