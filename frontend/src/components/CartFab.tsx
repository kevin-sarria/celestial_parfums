import { FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../application/context/useCart';
import '../styles/cart.css';

export default function CartFab() {
  const { totalItems, openCart } = useCart();

  return (
    <button className="cart-fab" onClick={openCart} aria-label="Ver carrito">
      <FiShoppingCart />
      {totalItems > 0 && <span className="cart-fab-badge">{totalItems}</span>}
    </button>
  );
}
