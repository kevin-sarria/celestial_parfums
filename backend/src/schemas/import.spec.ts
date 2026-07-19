export interface ImportColumn {
  key: string;
  required: boolean;
  descripcion: string;
  ejemplo: string | number;
}

export interface ImportSpec {
  titulo: string;
  columnas: ImportColumn[];
  notas: string[];
}

export const IMPORT_SPECS: Record<string, ImportSpec> = {
  perfumes: {
    titulo: 'Importar perfumes',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre del perfume', ejemplo: 'Invictus' },
      { key: 'precio', required: true, descripcion: 'Precio en COP (solo numeros)', ejemplo: 45000 },
      { key: 'descripcion', required: false, descripcion: 'Descripcion del perfume', ejemplo: 'Fragancia fresca y amaderada' },
      { key: 'duracion', required: false, descripcion: 'Duracion aproximada', ejemplo: '6-8 horas' },
      { key: 'proyeccion', required: false, descripcion: 'Proyeccion del aroma', ejemplo: 'Moderada' },
      { key: 'genero', required: false, descripcion: 'dama, caballero o unisex (vacio = sin especificar)', ejemplo: 'caballero' },
      { key: 'categoria', required: false, descripcion: 'Nombre de una categoria existente', ejemplo: 'Arabes' },
      { key: 'image_url', required: false, descripcion: 'URL de la imagen (puede quedar vacia)', ejemplo: 'https://ejemplo.com/invictus.jpg' },
      { key: 'tipos_aroma', required: false, descripcion: 'Nombres separados por comas', ejemplo: 'Citrico, Amaderado' },
      { key: 'ocasiones', required: false, descripcion: 'Nombres separados por comas', ejemplo: 'Fiesta, Diario' },
      { key: 'presentaciones', required: false, descripcion: 'Nombres separados por comas', ejemplo: '30ML, 60ML' },
      { key: 'descuento', required: false, descripcion: 'Porcentaje de descuento (0 a 100)', ejemplo: 0 },
    ],
    notas: [
      'tipos_aroma, ocasiones y presentaciones se escriben separados por comas. Si un valor no existe en la base de datos, esa relacion simplemente se omite (el perfume se crea igual).',
      'categoria debe coincidir con una categoria existente; si no existe, el perfume queda sin categoria.',
      'image_url puede quedar vacia sin problema.',
    ],
  },
  aromas: {
    titulo: 'Importar tipos de aroma',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre del tipo de aroma', ejemplo: 'Citrico' },
    ],
    notas: ['Los nombres duplicados (ya existentes) se omiten automaticamente.'],
  },
  ocasiones: {
    titulo: 'Importar ocasiones',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre de la ocasion', ejemplo: 'Fiesta' },
    ],
    notas: ['Los nombres duplicados (ya existentes) se omiten automaticamente.', 'Las ocasiones no requieren imagen.'],
  },
  categorias: {
    titulo: 'Importar categorias',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre de la categoria', ejemplo: 'Arabes' },
    ],
    notas: ['Los nombres duplicados (ya existentes) se omiten automaticamente.'],
  },
  presentaciones: {
    titulo: 'Importar presentaciones',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre de la presentacion', ejemplo: '30ML' },
    ],
    notas: ['Los nombres duplicados (ya existentes) se omiten automaticamente.', 'Las presentaciones no requieren imagen.'],
  },
  combos: {
    titulo: 'Importar combos',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre del combo', ejemplo: 'Combo Duo' },
      { key: 'precio', required: true, descripcion: 'Precio en COP (solo numeros)', ejemplo: 80000 },
      { key: 'cantidad', required: true, descripcion: 'Cantidad de perfumes que incluye', ejemplo: 2 },
      { key: 'descripcion', required: false, descripcion: 'Descripcion del combo', ejemplo: 'Dos perfumes a eleccion' },
      { key: 'categoria', required: false, descripcion: 'Nombre de una categoria existente', ejemplo: 'Promociones' },
      { key: 'image_url', required: false, descripcion: 'URL de la imagen (puede quedar vacia)', ejemplo: 'https://ejemplo.com/combo.jpg' },
      { key: 'descuento', required: false, descripcion: 'Porcentaje de descuento (0 a 100)', ejemplo: 10 },
      { key: 'activo', required: false, descripcion: 'si o no (vacio = si)', ejemplo: 'si' },
    ],
    notas: [
      'categoria debe coincidir con una categoria existente; si no existe, el combo queda sin categoria.',
      'image_url puede quedar vacia sin problema.',
    ],
  },
  descuentos: {
    titulo: 'Importar descuentos',
    columnas: [
      { key: 'tipo', required: true, descripcion: 'perfume o combo', ejemplo: 'perfume' },
      { key: 'nombre', required: true, descripcion: 'Nombre exacto del perfume o combo', ejemplo: 'Invictus' },
      { key: 'descuento', required: true, descripcion: 'Porcentaje de descuento (0 a 100)', ejemplo: 15 },
    ],
    notas: [
      'Actualiza el descuento de perfumes o combos ya existentes; el nombre debe coincidir con uno registrado.',
      'Si el nombre no se encuentra, la fila se reporta como error y se continua con las demas.',
    ],
  },
  ventas: {
    titulo: 'Importar ventas',
    columnas: [
      { key: 'dia', required: true, descripcion: 'Fecha de la venta (AAAA-MM-DD)', ejemplo: '2026-07-12' },
      { key: 'persona', required: true, descripcion: 'Nombre de la persona que compro', ejemplo: 'Maria Lopez' },
      { key: 'cantidad_perfumes', required: false, descripcion: 'Cantidad vendida (vacio = 1)', ejemplo: 1 },
      { key: 'presentacion', required: false, descripcion: 'Presentacion vendida (vacio = 30ML)', ejemplo: '30ML' },
      { key: 'referencia_perfume', required: true, descripcion: 'Referencia(s) del perfume vendido', ejemplo: 'Invictus' },
      { key: 'valor_venta', required: true, descripcion: 'Valor de la venta en COP', ejemplo: 45000 },
      { key: 'datos_adicionales', required: false, descripcion: 'Observaciones de la venta', ejemplo: 'Pago en efectivo' },
    ],
    notas: ['Las fechas deben tener formato AAAA-MM-DD o ser celdas de fecha de Excel.'],
  },
  creditos: {
    titulo: 'Importar creditos',
    columnas: [
      { key: 'fecha', required: true, descripcion: 'Fecha del credito (AAAA-MM-DD)', ejemplo: '2026-07-12' },
      { key: 'nombre_cliente', required: true, descripcion: 'Nombre del cliente', ejemplo: 'Maria' },
      { key: 'apellido_cliente', required: true, descripcion: 'Apellido del cliente', ejemplo: 'Lopez' },
      { key: 'telefono', required: false, descripcion: 'Telefono del cliente', ejemplo: '3001234567' },
      { key: 'correo', required: false, descripcion: 'Correo del cliente', ejemplo: 'maria@correo.com' },
      { key: 'articulos', required: true, descripcion: 'Articulos entregados a credito', ejemplo: 'Perfume Invictus 30ML' },
      { key: 'deuda_inicial', required: true, descripcion: 'Valor inicial de la deuda en COP', ejemplo: 45000 },
      { key: 'abonos', required: false, descripcion: 'Montos abonados separados por comas', ejemplo: '10000, 5000' },
    ],
    notas: [
      'Si el cliente (nombre + apellido + telefono) ya existe, se reutiliza; si no, se crea automaticamente.',
      'Los abonos se escriben separados por comas y se registran con la fecha del credito.',
    ],
  },
  proveedores: {
    titulo: 'Importar pagos a proveedores',
    columnas: [
      { key: 'dia', required: true, descripcion: 'Fecha del pago (AAAA-MM-DD)', ejemplo: '2026-07-12' },
      { key: 'empresa', required: true, descripcion: 'Nombre de la empresa proveedora', ejemplo: 'Esencias del Valle' },
      { key: 'valor_compra', required: true, descripcion: 'Valor de la compra en COP', ejemplo: 500000 },
      { key: 'coste_envio', required: false, descripcion: 'Costo del envio en COP (vacio = 0)', ejemplo: 20000 },
      { key: 'detalles_adicionales', required: false, descripcion: 'Observaciones del pago', ejemplo: 'Pedido mensual' },
    ],
    notas: ['Si la empresa no existe, se crea automaticamente con ese nombre.'],
  },
};
