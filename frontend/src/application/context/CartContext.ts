import { createContext } from 'react';

export interface CartItem {
  id: string;
  productoId: number;
  nombre: string;
  tipo: string;
  presentacion: string;
  genero: string | null;
  cantidad: number;
  /** Precio final unitario (ya con el descuento propio del producto aplicado). */
  precio: number;
  /** Descuento propio del producto (%); si es >0, un cupón NO se acumula encima. */
  descuento: number;
  imagen_url: string | null;
  esCombo: boolean;
}

export interface CartContextType {
  items: CartItem[];
  totalItems: number;
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, cantidad: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

export const CartContext = createContext<CartContextType | null>(null);
