import { hoy } from '../../../utils/fechas';

/**
 * LO QUE SALE DE LA CAJA: proveedores, pagos e inventario.
 *
 * Un pago a proveedor y una línea de bodega son la misma historia contada en
 * dos momentos —lo que compraste y lo que te queda—, y comparten el IVA y las
 * unidades en que se factura.
 */

/** Cómo factura el IVA un proveedor. Define el costo real de lo que se le compra. */
export type IvaModo = 'incluido' | 'agregado' | 'sin_iva';

export interface Empresa {
  id: number;
  nombre: string;
  nit: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  /** Se configura una vez y todas sus compras la heredan. */
  iva_modo: IvaModo;
}

export interface Pago {
  id: number;
  dia: string;
  empresa: { id: number; nombre: string; nit: string | null };
  valor_compra: number;
  coste_envio: number;
  detalles_adicionales: string | null;
  numero_factura: string | null;
  archivos: string[];
  /** Cómo se liquidó el IVA de esta factura (congelado). Null en los históricos. */
  iva_modo: IvaModo | null;
  iva_tasa: number | null;
  iva_valor: number;
  /** Detalle de la compra; vacío en los pagos históricos. */
  items: {
    id: number; insumo_id: number; insumo_nombre: string;
    cantidad: number; unidad_compra: 'ml' | 'g' | 'l' | 'kg' | 'unidad';
    subtotal: number; costo_unitario_final: number;
    base_gravable: number | null; iva_valor: number | null;
  }[];
}

/** Una línea del inventario con su valor. */
export interface InventarioInsumo {
  id: number; nombre: string; tipo: string; unidad: string;
  /** Apagado = jubilado: no aparece al comprar ni producir, y no suma al total. */
  activo: boolean;
  stock: number; costo_promedio: number; valor: number;
  /** Punto de pedido; 0 = alerta apagada. */
  stock_minimo: number;
  bajo_minimo: boolean;
  /** Cuánto pedir para volver a un colchón razonable. */
  sugerido: number;
  /** Solo esencias: a qué gama pertenece. Null = sin clasificar. */
  gama_id?: number | null;
  gama_nombre?: string | null;
  /** Solo esencias: para quién es la fragancia. Null = todavía sin decir. */
  genero?: 'dama' | 'caballero' | 'unisex' | null;
}

/**
 * Un perfume × talla del que YA hay frascos armados.
 *
 * Es inventario igual que el material: al producir, la plata sale de los
 * insumos y se queda aquí. El costo es el del día que se armó, congelado.
 * Negativo = se vendió algo que no estaba armado; hay que mirarlo.
 */
export interface FrascoArmado {
  perfume_id: number; presentacion_id: number;
  perfume: string; talla: string; ml: number | null;
  cantidad: number; costo_unitario: number; valor: number;
}

/** Lo que devuelve `GET /inventario`: la pantalla entera de bodega. */
export interface ResumenInventario {
  insumos: InventarioInsumo[];
  valor_total: number;
  salidas_mes: { muestras: number; mermas: number; ajustes: number };
  terminado: { filas: FrascoArmado[]; unidades: number; valor: number };
}

export interface MovimientoInventario {
  id: number; tipo: 'compra' | 'produccion' | 'garantia' | 'ajuste' | 'merma' | 'muestra';
  cantidad: number; costo_unitario: number; fecha: string;
  referencia_id: number | null; nota: string | null;
}

export interface Produccion {
  id: number; fecha: string; formula_volumen_id: number; volumen_nombre: string;
  perfume_nombre: string | null;
  cantidad: number; costo_unitario: number; costo_total: number; nota: string | null;
}

export interface PagoForm {
  dia: string; empresa_id: number | 'nuevo' | '';
  nueva_nombre: string; nueva_nit: string; nueva_telefono: string;
  nueva_correo: string; nueva_direccion: string;
  valor_compra: string; coste_envio: string; detalles_adicionales: string;
  numero_factura: string;
  /** Solo al dar de alta un proveedor desde la compra: cómo factura el IVA. */
  nueva_iva_modo: IvaModo;
}

export const emptyPagoForm = (): PagoForm => ({
  dia: hoy(),
  empresa_id: '',
  nueva_nombre: '', nueva_nit: '', nueva_telefono: '', nueva_correo: '', nueva_direccion: '',
  valor_compra: '', coste_envio: '0', detalles_adicionales: '', numero_factura: '',
  // 'incluido' por defecto: nunca infla un costo por descuido
  nueva_iva_modo: 'incluido',
});
