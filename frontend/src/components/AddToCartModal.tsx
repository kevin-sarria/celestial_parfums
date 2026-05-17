import { useState, useEffect } from 'react';
import Modal from './Modal';
import { useCart } from '../application/context/useCart';
import '../styles/cart.css';

interface Props {
  open: boolean;
  onClose: () => void;
  producto: {
    id: number;
    nombre: string;
    precio: number;
    imagen_url: string | null;
    esCombo: boolean;
    categoria: string | null;
    genero: string | null;
    presentaciones: string[];
  };
}

export default function AddToCartModal({ open, onClose, producto }: Props) {
  const { addItem } = useCart();
  const [cantidad, setCantidad] = useState(1);
  const [presentacion, setPresentacion] = useState('');

  const tipo = producto.categoria ?? '';
  const presentaciones = producto.presentaciones ?? [];

  useEffect(() => {
    if (open) {
      setCantidad(1);
      setPresentacion(presentaciones[0] ?? '');
    }
  }, [open]);

  const handleSubmit = (e: { preventDefault(): void }) => {
    e.preventDefault();
    addItem({
      productoId: producto.id,
      nombre: producto.nombre,
      tipo,
      presentacion,
      genero: producto.genero,
      cantidad,
      precio: producto.precio,
      imagen_url: producto.imagen_url,
      esCombo: producto.esCombo,
    });
    setCantidad(1);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agregar al carrito"
      onSubmit={handleSubmit}
      submitLabel="Agregar al carrito"
      maxWidth={420}
    >
      <div className="atc-product">
        {producto.imagen_url && <img src={producto.imagen_url} alt={producto.nombre} className="atc-product-img" />}
        <div className="atc-product-info">
          <span className="atc-product-name">{producto.nombre}</span>
          {tipo && <span className="atc-product-tipo">{tipo}</span>}
        </div>
      </div>

      {presentaciones.length > 0 && (
        <div className="dash-form-group">
          <label>Presentacion</label>
          <div className="atc-chips">
            {presentaciones.map(p => (
              <button
                key={p}
                type="button"
                className={`atc-chip${presentacion === p ? ' atc-chip--active' : ''}`}
                onClick={() => setPresentacion(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dash-form-group">
        <label>Cantidad</label>
        <div className="atc-qty">
          <button type="button" onClick={() => setCantidad(q => Math.max(1, q - 1))}>-</button>
          <span>{cantidad}</span>
          <button type="button" onClick={() => setCantidad(q => q + 1)}>+</button>
        </div>
      </div>
    </Modal>
  );
}
