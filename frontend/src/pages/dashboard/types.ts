export interface Lookup {
  id: number;
  nombre: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  correo: string | null;
  telefono: string | null;
  direccion: string | null;
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
  cantidad_perfumes: number;
  presentacion: string;
  referencia_perfume: string;
  valor_venta: number;
  datos_adicionales: string | null;
}

export interface CreditoAbono {
  id: number;
  monto: number;
  fecha: string;
}

export interface Credito {
  id: number;
  fecha: string;
  cliente: Cliente;
  articulos: string;
  deuda_inicial: number;
  abonos: CreditoAbono[];
  total_abonado: number;
  total_en_deuda: number;
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
  proyeccion: string; imagen_url: string; genero: 'hombre' | 'mujer' | '';
  categoria_id: number | ''; tipos_aroma: number[]; ocasiones: number[]; presentaciones: number[];
}

export const emptyPerfumeForm = (): PerfumeForm => ({
  nombre: '', descripcion: '', precio: '', duracion: '',
  proyeccion: '', imagen_url: '', genero: '', categoria_id: '',
  tipos_aroma: [], ocasiones: [], presentaciones: [],
});

export interface VentaForm {
  dia: string; persona: string; cantidad_perfumes: string;
  presentacion: string; referencia_perfume: string; valor_venta: string;
  datos_adicionales: string;
}

export const emptyVentaForm = (): VentaForm => ({
  dia: new Date().toISOString().slice(0, 10),
  persona: '', cantidad_perfumes: '1', presentacion: '30ML',
  referencia_perfume: '', valor_venta: '', datos_adicionales: '',
});

export interface CreditoForm {
  fecha: string; cliente_id: number | 'nuevo' | '';
  nuevo_nombre: string; nuevo_apellido: string; nuevo_correo: string;
  nuevo_telefono: string; nuevo_direccion: string;
  articulos: string; deuda_inicial: string;
}

export const emptyCreditoForm = (): CreditoForm => ({
  fecha: new Date().toISOString().slice(0, 10),
  cliente_id: '',
  nuevo_nombre: '', nuevo_apellido: '', nuevo_correo: '',
  nuevo_telefono: '', nuevo_direccion: '',
  articulos: '', deuda_inicial: '',
});

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
  categoria_id: number | ''; cantidad: string; precio: string;
  descuento: string; activo: boolean;
}

export const emptyComboForm = (): ComboForm => ({
  nombre: '', descripcion: '', imagen_url: '', categoria_id: '',
  cantidad: '2', precio: '', descuento: '0', activo: true,
});

export type Tab = 'perfumes' | 'aromas' | 'ocasiones' | 'categorias' | 'presentaciones' | 'combos' | 'descuentos' | 'ventas' | 'creditos' | 'pagos';

export type GuardedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
