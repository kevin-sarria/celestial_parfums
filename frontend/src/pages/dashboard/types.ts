export interface Lookup {
  id: number;
  nombre: string;
  /** Solo categorías: % de descuento general que heredan sus perfumes. */
  descuento?: number;
}

/** Perfil crediticio interno calculado por el backend (SOLO admin). */
export interface PerfilCredito {
  user_id: number;
  nombre: string;
  cupo_base: number;
  factor: number;
  cupo: number;
  deuda_total: number;
  cupo_disponible: number;
  vetado: boolean;
  tiene_credito_activo: boolean;
  eventos: { tipo: 'pago_rapido' | 'pago_lento' | 'cupon_vencido' | 'veto'; credito_id: number; detalle: string }[];
  creditos: {
    id: number; fecha: string; articulos: string; deuda_inicial: number;
    abonado: number; saldo: number; dias_sin_abono: number;
    abonos: { monto: number; fecha: string }[];
  }[];
}

export interface Empresa {
  id: number;
  nombre: string;
  nit: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
}

export interface Venta {
  id: number;
  dia: string;
  persona: string;
  user_id: number | null;
  user: { id: number; nombre: string; apellido: string; telefono: string | null; email: string } | null;
  cantidad_perfumes: number;
  presentacion: string;
  referencia_perfume: string;
  /** Perfumes del catálogo incluidos en la venta (un combo lleva varios; cantidad = unidades de esa fragancia). */
  perfumes: { id: number; nombre: string; cantidad: number }[];
  valor_venta: number;
  datos_adicionales: string | null;
  /** false = pendiente de pago; al marcarla pagada se canjea el código enlazado. */
  pagada: boolean;
  /** Código único de descuento enlazado al pedido (si lo hubo). */
  codigo: { codigo: string; estado: 'activo' | 'canjeado' | 'anulado'; titulo: string; descuento_pct: number } | null;
}

export interface CreditoAbono {
  id: number;
  monto: number;
  fecha: string;
}

export interface Credito {
  id: number;
  fecha: string;
  /** Acuerdo de pago: fecha límite pactada (por defecto 1 mes desde la fecha). */
  fecha_limite: string | null;
  /** La persona (usuario o ficha) dueña del crédito. */
  cliente: {
    id: number; nombre: string; apellido: string;
    telefono: string | null; correo: string | null; direccion: string | null;
    sin_cuenta?: boolean;
  };
  articulos: string;
  deuda_inicial: number;
  abonos: CreditoAbono[];
  total_abonado: number;
  total_en_deuda: number;
  /** true = sigue con saldo pasada la fecha límite. */
  vencido: boolean;
  /** Cupón canjeado en este crédito (si lo hubo). */
  codigo: { codigo: string; descuento_pct: number; max_descuento: number; titulo: string } | null;
  /** Resumen de presentaciones de la venta enlazada (para reconstruir el editor). */
  presentacion: string;
  /** Perfumes enlazados con su cantidad (para reconstruir las líneas al editar). */
  productos: { perfume_id: number; cantidad: number }[];
  /** Venta enlazada: nace pendiente con el crédito y se paga al saldarlo. */
  venta: { id: number; pagada: boolean } | null;
}

export interface Pago {
  id: number;
  dia: string;
  empresa: { id: number; nombre: string; nit: string | null };
  valor_compra: number;
  coste_envio: number;
  detalles_adicionales: string | null;
}

export interface PerfumeForm {
  nombre: string; descripcion: string; precio: string; duracion: string;
  proyeccion: string; imagen_url: string; genero: 'dama' | 'caballero' | 'unisex' | '';
  categoria_id: number | ''; tipos_aroma: number[]; ocasiones: number[]; presentaciones: number[];
  /** Contratipo hecho con la esencia de mayor calidad: distintivo y fuera de combos. */
  esencia_premium: boolean;
  /** Precio propio por presentación (id → texto); vacío = usa la lista de su categoría. */
  precios_propios: Record<number, string>;
}

export const emptyPerfumeForm = (): PerfumeForm => ({
  nombre: '', descripcion: '', precio: '', duracion: '',
  proyeccion: '', imagen_url: '', genero: '', categoria_id: '',
  tipos_aroma: [], ocasiones: [], presentaciones: [],
  esencia_premium: false, precios_propios: {},
});

/** Una fila de la lista de precios: lo que vale una presentación en una categoría. */
export interface PrecioLista {
  categoria_id: number;
  categoria: string;
  presentacion_id: number;
  presentacion: string;
  precio: number;
}

/**
 * Valor del desplegable de persona enlazada en ventas/créditos:
 * número = usuario/ficha existente, 'nuevo' = crear ficha, '' = sin enlace.
 */
export type ClienteSeleccion = number | 'nuevo' | '';

export interface VentaForm {
  dia: string; persona: string; cantidad_perfumes: string;
  presentacion: string; valor_venta: string;
  datos_adicionales: string;
  /** Perfumes del catálogo seleccionados (al menos uno). */
  perfume_ids: number[];
  user_id: ClienteSeleccion;
  /** false = pendiente de pago (el código queda reservado, no canjeado). */
  pagada: boolean;
  /** Código único de descuento recibido en el pedido de WhatsApp. */
  codigo_descuento: string;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
}

export const emptyVentaForm = (): VentaForm => ({
  dia: new Date().toISOString().slice(0, 10),
  persona: '', cantidad_perfumes: '1', presentacion: '30ML',
  valor_venta: '', datos_adicionales: '',
  perfume_ids: [],
  user_id: '',
  pagada: true,
  codigo_descuento: '',
  nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
  nuevo_telefono: '', nuevo_direccion: '',
});

/** Una línea del crédito: un perfume con su talla, cantidad y si lleva descuento. */
export interface LineaCredito {
  /** clave estable para React (varias líneas del mismo perfume son válidas) */
  key: string;
  perfume_id: number;
  presentacion: string;
  cantidad: number;
  /** true = a este cliente NO se le aplica el descuento de la página en esta línea */
  sin_descuento: boolean;
}

export interface CreditoForm {
  fecha: string; user_id: ClienteSeleccion;
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
  /** Texto de artículos: se arma solo con las líneas (o se edita a mano). */
  articulos: string; deuda_inicial: string;
  /** Productos del crédito (editor de líneas). */
  lineas: LineaCredito[];
  /** true = aplicar precio de combo (mayoreo) a este crédito. */
  aplicar_combo: boolean;
  /** true = la deuda se editó a mano; deja de recalcularse desde las líneas. */
  deuda_manual: boolean;
  /** Fecha límite pactada (por defecto 1 mes desde la fecha). */
  fecha_limite: string;
  /** Código de descuento a canjear en el crédito (opcional). */
  codigo_descuento: string;
}

/** Fecha AAAA-MM-DD un mes después de la dada (por defecto del acuerdo de pago). */
export const unMesDespues = (fecha: string) => {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

export const emptyCreditoForm = (): CreditoForm => {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    fecha: hoy,
    user_id: '',
    nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
    nuevo_telefono: '', nuevo_direccion: '',
    articulos: '', deuda_inicial: '',
    lineas: [], aplicar_combo: false, deuda_manual: false,
    fecha_limite: unMesDespues(hoy),
    codigo_descuento: '',
  };
};

export interface PagoForm {
  dia: string; empresa_id: number | 'nuevo' | '';
  nueva_nombre: string; nueva_nit: string; nueva_telefono: string;
  nueva_correo: string; nueva_direccion: string;
  valor_compra: string; coste_envio: string; detalles_adicionales: string;
}

export const emptyPagoForm = (): PagoForm => ({
  dia: new Date().toISOString().slice(0, 10),
  empresa_id: '',
  nueva_nombre: '', nueva_nit: '', nueva_telefono: '', nueva_correo: '', nueva_direccion: '',
  valor_compra: '', coste_envio: '0', detalles_adicionales: '',
});

export interface ComboForm {
  nombre: string; descripcion: string; imagen_url: string;
  categoria_id: number | '';
  /** Presentación de los perfumes del combo ('' = cualquier tamaño). */
  presentacion_id: number | '';
  cantidad: string; precio: string;
  descuento: string; activo: boolean;
}

export const emptyComboForm = (): ComboForm => ({
  nombre: '', descripcion: '', imagen_url: '', categoria_id: '', presentacion_id: '',
  cantidad: '2', precio: '', descuento: '0', activo: true,
});

/** Persona del sistema: cuenta web real o ficha creada por el admin (sin_cuenta). */
export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  rol_id: number;
  rol: string | null;
  activo: boolean;
  telefono: string | null;
  direccion: string | null;
  cupo_base: number;
  sin_cuenta: boolean;
  /** Códigos de descuento emitidos y aún sin canjear. */
  codigos_activos: { codigo: string; titulo: string; descuento_pct: number }[];
  created_at: string;
}

export interface UsuarioForm {
  nombre: string; apellido: string; email: string;
  activo: boolean; password: string;
  telefono: string; direccion: string;
}

/** Ventana emergente configurable del catálogo (publicidad). */
export interface Anuncio {
  id: number;
  titulo: string;
  mensaje: string | null;
  imagen_url: string | null;
  tipo: 'imagen' | 'mensaje' | 'descuento';
  audiencia: 'todos' | 'no_registrados' | 'registrados';
  una_vez: boolean;
  activo: boolean;
  orden: number;
  inicio: string | null;
  fin: string | null;
  descuento_pct: number;
  aplica_combos: boolean;
  /** Reglas para que el cupón aplique en el carrito (0 = sin mínimo). */
  min_unidades: number;
  min_monto: number;
  /** Guardarraíles (0 = sin límite): tope del descuento en pesos y cupo de canjes. */
  max_descuento: number;
  max_canjes: number;
  categoria_ids: number[];
  categorias: string[];
  /** Códigos emitidos sin canjear / canjeados en ventas pagadas. */
  codigos_activos: number;
  codigos_canjeados: number;
}

export interface AnuncioForm {
  titulo: string; mensaje: string; imagen_url: string;
  tipo: Anuncio['tipo']; audiencia: Anuncio['audiencia'];
  una_vez: boolean; activo: boolean; orden: string;
  inicio: string; fin: string;
  descuento_pct: string; aplica_combos: boolean; categoria_ids: number[];
  min_unidades: string; min_monto: string;
  max_descuento: string; max_canjes: string;
}

export const emptyAnuncioForm = (): AnuncioForm => ({
  titulo: '', mensaje: '', imagen_url: '',
  tipo: 'mensaje', audiencia: 'todos',
  una_vez: true, activo: true, orden: '0',
  inicio: '', fin: '',
  descuento_pct: '10', aplica_combos: false, categoria_ids: [],
  min_unidades: '0', min_monto: '0',
  max_descuento: '0', max_canjes: '0',
});

/** Resultado de la certificación de un código de descuento (admin). */
export interface CodigoValidado {
  valido: boolean;
  codigo: string;
  estado?: 'activo' | 'canjeado' | 'anulado';
  motivo: string;
  cupon?: {
    id: number; titulo: string; descuento_pct: number;
    aplica_combos: boolean; categorias: string[];
    min_unidades: number; min_monto: number;
    max_descuento: number;
  };
  persona?: string;
  emitido?: string;
  venta?: { id: number; persona: string; dia: string } | null;
}

export type Tab = 'perfumes' | 'aromas' | 'ocasiones' | 'categorias' | 'presentaciones' | 'combos' | 'precios' | 'descuentos' | 'ventas' | 'creditos' | 'pagos' | 'usuarios' | 'publicidad' | 'redes';

export type GuardedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
