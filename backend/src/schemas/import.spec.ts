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
      { key: 'precios_presentacion', required: false, descripcion: 'Precio propio por talla (solo si NO usa el de la lista)', ejemplo: '30ML=60000, 100ML=150000' },
      { key: 'esencia_premium', required: false, descripcion: 'si o no: esencia de mayor calidad (nunca entra en combos)', ejemplo: 'no' },
      { key: 'descuento', required: false, descripcion: 'Porcentaje de descuento (0 a 100)', ejemplo: 0 },
    ],
    notas: [
      'tipos_aroma, ocasiones y presentaciones se escriben separados por comas. Si un valor no existe en la base de datos, esa relacion simplemente se omite (el perfume se crea igual).',
      'categoria debe coincidir con una categoria existente; si no existe, el perfume queda sin categoria.',
      'image_url puede quedar vacia sin problema.',
      'El precio normal NO se escribe aqui: sale de la lista de precios (Catalogo > Precios) segun la categoria y la talla. La columna precio solo se usa de respaldo cuando no hay lista.',
      'precios_presentacion es para las excepciones (ej: los de esencia premium): se escribe TALLA=VALOR separado por comas.',
    ],
  },
  precios: {
    titulo: 'Importar lista de precios',
    columnas: [
      { key: 'categoria', required: true, descripcion: 'Nombre de una categoria existente', ejemplo: 'Contratipo' },
      { key: 'presentacion', required: true, descripcion: 'Nombre de una presentacion existente', ejemplo: '30ML' },
      { key: 'precio', required: true, descripcion: 'Precio estandar en COP de esa talla en esa categoria', ejemplo: 22000 },
    ],
    notas: [
      'Es la lista de precios del negocio: lo que vale cada talla en cada categoria.',
      'Todos los perfumes de esa categoria cobran ese precio, salvo los que tengan precio propio en su ficha.',
      'Si la combinacion ya existe se ACTUALIZA (no se duplica): sirve para subir precios en bloque.',
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
  publicidad: {
    titulo: 'Importar publicidad',
    columnas: [
      { key: 'titulo', required: true, descripcion: 'Titulo del anuncio', ejemplo: 'Bienvenida con 10% de descuento' },
      { key: 'tipo', required: true, descripcion: 'mensaje, imagen o descuento (cupon)', ejemplo: 'descuento' },
      { key: 'mensaje', required: false, descripcion: 'Texto que ve el visitante', ejemplo: 'Registrate y llevate 10% en tu primera compra' },
      { key: 'image_url', required: false, descripcion: 'URL de la imagen (solo tipo imagen)', ejemplo: '' },
      { key: 'audiencia', required: false, descripcion: 'todos, registrados o no_registrados (vacio = todos)', ejemplo: 'registrados' },
      { key: 'activo', required: false, descripcion: 'si o no (vacio = si)', ejemplo: 'si' },
      { key: 'una_vez', required: false, descripcion: 'si = se ve una sola vez por visitante (vacio = si)', ejemplo: 'si' },
      { key: 'orden', required: false, descripcion: 'Orden en que aparece (vacio = 0)', ejemplo: 1 },
      { key: 'inicio', required: false, descripcion: 'Desde cuando se muestra (AAAA-MM-DD)', ejemplo: '2026-08-01' },
      { key: 'fin', required: false, descripcion: 'Hasta cuando se muestra (AAAA-MM-DD)', ejemplo: '2026-08-31' },
      { key: 'descuento_pct', required: false, descripcion: 'Porcentaje del cupon (0 a 100)', ejemplo: 10 },
      { key: 'categorias', required: false, descripcion: 'Categorias que cubre el cupon, separadas por comas', ejemplo: 'Contratipo, Originales' },
      { key: 'aplica_combos', required: false, descripcion: 'si o no: el cupon tambien cubre combos', ejemplo: 'no' },
      { key: 'min_unidades', required: false, descripcion: 'Unidades minimas para que aplique (0 = sin minimo)', ejemplo: 3 },
      { key: 'min_monto', required: false, descripcion: 'Compra minima en COP (0 = sin minimo)', ejemplo: 60000 },
      { key: 'max_descuento', required: false, descripcion: 'Tope del descuento en COP por canje (0 = sin tope)', ejemplo: 20000 },
      { key: 'max_canjes', required: false, descripcion: 'Cupo total de cupones de la campana (0 = sin limite)', ejemplo: 100 },
    ],
    notas: [
      'Los cupones ya emitidos NO se exportan ni se importan: el archivo lleva las campanas, no los codigos de cada persona.',
      'Importar crea anuncios nuevos; no actualiza los que ya existen. Si vuelves a subir el mismo archivo tendras el anuncio repetido.',
      'Las columnas de cupon (descuento_pct, categorias, minimos y topes) solo se usan cuando el tipo es "descuento"; en los otros tipos se guardan en cero.',
      'categorias debe coincidir con categorias existentes; las que no existan se omiten.',
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

  insumos: {
    titulo: 'Importar insumos y costos',
    columnas: [
      { key: 'nombre', required: true, descripcion: 'Nombre del insumo (Esencia Eternity, Envase 30 ml...)', ejemplo: 'Esencia Eternity' },
      { key: 'tipo', required: true, descripcion: 'materia_prima, envase o accesorio', ejemplo: 'materia_prima' },
      // La lista NO se escribe aqui: las gamas son una tabla que el dueno amplia
      // ("nicho", "nicho premium"), asi que cualquier lista quemada en el texto
      // miente en cuanto crea una. Si el valor no existe, el importador responde
      // con las que SI hay, leidas de la base.
      { key: 'gama', required: false, descripcion: 'Solo esencias: el nombre de la gama tal como la creaste. Vacio en lo demas', ejemplo: 'Arabe' },
      { key: 'genero', required: false, descripcion: 'Solo esencias: dama, caballero o unisex. Vacio si no lo sabes', ejemplo: 'dama' },
      { key: 'unidad', required: false, descripcion: 'ml (liquidos) o unidad (piezas)', ejemplo: 'ml' },
      { key: 'alcance', required: false, descripcion: 'unidad (por perfume) o pedido (una vez por envio)', ejemplo: 'unidad' },
      { key: 'costo_promedio', required: false, descripcion: 'Costo por ml o por pieza. Vacio o 0 = no se toca', ejemplo: 1200 },
      { key: 'existencias', required: false, descripcion: 'Informativo al exportar; NO se importa desde aqui', ejemplo: 100 },
      { key: 'activo', required: false, descripcion: 'si o no', ejemplo: 'si' },
    ],
    notas: [
      'Cada esencia va como un insumo APARTE (Esencia Eternity, Esencia Khamrah...): cada fragancia cuesta distinto y promediarlas da un costo que no es el de ninguna.',
      'Si el nombre ya existe se ACTUALIZA; si no, se crea.',
      'Las EXISTENCIAS no se cambian aqui: se siembran con la hoja "inventario" (conteo fisico) o entran con las compras a proveedores.',
      'El costo_promedio solo hace falta al arrancar: despues lo calcula solo con cada compra.',
      'La GAMA es la calidad de la esencia pura (clasica, arabe, premium, disenador). Sirve para cotizar al mayoreo cuando el cliente pide "50 de 30 ml" sin decir que fragancias: ahi se costea con el promedio de la gama.',
      'Los envases, accesorios, el diluyente, el sellador y las feromonas NO llevan gama ni genero: dejalos vacios.',
      'El GENERO evita confundir dos fragancias de la misma linea (un "212 VIP" de dama y otro de caballero). Esta es la forma rapida de llenarlo en bloque: exporta, escribe la columna y vuelve a subir.',
      'Una columna vacia NO borra lo que ya tenias: solo se cambia lo que escribas. Para quitar una gama o un genero escribe "ninguna".',
    ],
  },
  inventario: {
    titulo: 'Conteo fisico de inventario',
    columnas: [
      { key: 'insumo', required: true, descripcion: 'Nombre del material. Si no existe se CREA', ejemplo: 'Esencia Eternity' },
      { key: 'tipo', required: false, descripcion: 'Solo si el material es nuevo: materia_prima, envase o accesorio', ejemplo: 'materia_prima' },
      { key: 'unidad', required: false, descripcion: 'ml o unidad (solo pesa al crear uno nuevo)', ejemplo: 'ml' },
      // Van aqui tambien, y no solo en la hoja de materiales: esta hoja CREA
      // materiales, y una esencia nacida sin gama queda fuera del costeo por
      // gama en silencio. Ademas es la hoja que el dueno abre primero.
      { key: 'gama', required: false, descripcion: 'Solo esencias: el nombre de la gama tal como la creaste', ejemplo: 'Arabe' },
      { key: 'genero', required: false, descripcion: 'Solo esencias: dama, caballero o unisex', ejemplo: 'dama' },
      { key: 'existencias_sistema', required: false, descripcion: 'Lo que el sistema cree que hay (informativo)', ejemplo: 100 },
      { key: 'cantidad_real', required: true, descripcion: 'Lo que hay DE VERDAD tras contar', ejemplo: 96.5 },
      { key: 'costo_unitario', required: false, descripcion: 'Costo por unidad; solo se usa si el ajuste SUMA material', ejemplo: 1200 },
    ],
    notas: [
      'Es la forma comoda de sembrar el stock inicial: exporta la hoja, escribe lo que hay en cantidad_real y vuelvela a subir.',
      'Puedes AGREGAR filas de materiales que todavia no existen: se crean solos. En ese caso pon el "tipo" (materia_prima, envase o accesorio).',
      'Si la fila es una ESENCIA, aprovecha y ponle la gama y el genero: sin gama no entra en el costeo al mayoreo, y no se entera nadie. Una columna vacia no borra lo que ya tenias.',
      'Los nombres se comparan ignorando mayusculas y tildes, asi que "esencia khamrah" y "Esencia Khamrah" son el mismo material y NO se duplica.',
      'El sistema calcula la diferencia contra lo que tenia y la registra como movimiento de ajuste (queda auditable).',
      'La diferencia entre lo teorico y lo real ES el desperdicio del dia a dia: no hace falta anotar cada gramo que se va de mas.',
      'El costo_unitario solo pesa cuando el ajuste suma material (al arrancar). Si estas quitando, se valora al promedio que ya tiene.',
    ],
  },
  devoluciones: {
    titulo: 'Devoluciones y garantias',
    columnas: [
      { key: 'venta_id', required: true, descripcion: 'Numero de la venta a la que pertenece', ejemplo: 187 },
      { key: 'cliente', required: false, descripcion: 'Nombre de la venta (informativo)', ejemplo: 'Luz Gomez' },
      { key: 'fecha', required: true, descripcion: 'Cuando lo reporto el cliente (AAAA-MM-DD)', ejemplo: '2026-08-01' },
      { key: 'motivo', required: true, descripcion: 'llego_danado, llego_equivocado, llego_incompleto, envase_defectuoso, no_llego, otro', ejemplo: 'envase_defectuoso' },
      { key: 'detalle', required: false, descripcion: 'Que dijo el cliente', ejemplo: 'El atomizador no rocia' },
      { key: 'estado', required: false, descripcion: 'pendiente, en_revision, resuelta o rechazada', ejemplo: 'resuelta' },
      { key: 'solucion', required: false, descripcion: 'reposicion, devolucion_dinero o ninguna', ejemplo: 'devolucion_dinero' },
      { key: 'monto_devuelto', required: false, descripcion: 'Plata devuelta (solo si la solucion fue devolucion_dinero)', ejemplo: 25000 },
      { key: 'costo_reposicion', required: false, descripcion: 'Lo que costo producir lo repuesto', ejemplo: 0 },
      { key: 'costo_envio', required: false, descripcion: 'Envio de la garantia (lo asume el vendedor por ley)', ejemplo: 8000 },
      { key: 'fecha_resolucion', required: false, descripcion: 'Cuando se cerro el caso', ejemplo: '2026-08-05' },
      { key: 'origen', required: false, descripcion: 'admin o cliente (quien radico el caso)', ejemplo: 'cliente' },
      { key: 'notas', required: false, descripcion: 'Notas internas', ejemplo: 'Reclamado a la transportadora' },
    ],
    notas: [
      'Pensada sobre todo para EXPORTAR: es el respaldo de los reclamos ante la SIC (queda cuando se reporto y cuando se resolvio).',
      'La venta_id debe existir; una devolucion sin venta dejaria los ingresos descuadrados.',
      'No se puede devolver mas plata de la que costo la venta.',
    ],
  },
  movimientos: {
    titulo: 'Movimientos de inventario',
    columnas: [
      { key: 'fecha', required: true, descripcion: 'Fecha del movimiento', ejemplo: '2026-08-01' },
      { key: 'insumo', required: true, descripcion: 'Nombre del insumo', ejemplo: 'Esencia Eternity' },
      { key: 'tipo', required: true, descripcion: 'compra, produccion, garantia, ajuste, merma o muestra', ejemplo: 'compra' },
      { key: 'cantidad', required: true, descripcion: 'Positiva entra, negativa sale', ejemplo: 100 },
      { key: 'unidad', required: false, descripcion: 'ml o unidad', ejemplo: 'ml' },
      { key: 'costo_unitario', required: false, descripcion: 'Costo aplicado en ese momento', ejemplo: 1200 },
      { key: 'valor', required: false, descripcion: 'cantidad x costo', ejemplo: 120000 },
      { key: 'nota', required: false, descripcion: 'De donde vino', ejemplo: 'Factura FV-9001' },
    ],
    notas: [
      'Es el libro de auditoria del inventario: SOLO se exporta, no se importa.',
      'Si el stock se descuadra, este es el historial que permite reconstruirlo.',
    ],
  },

  resenas: {
    titulo: 'Resenas de clientes',
    columnas: [
      { key: 'id', required: true, descripcion: 'Numero de la resena (NO cambiar: es como se identifica)', ejemplo: 12 },
      { key: 'perfume', required: false, descripcion: 'Perfume resenado (informativo)', ejemplo: 'Invictus' },
      { key: 'cliente', required: false, descripcion: 'Quien la escribio (informativo)', ejemplo: 'Luz Gomez' },
      { key: 'correo', required: false, descripcion: 'Correo del cliente (informativo)', ejemplo: 'luz@correo.com' },
      { key: 'estrellas', required: false, descripcion: 'Calificacion 1 a 5 (informativo)', ejemplo: 5 },
      { key: 'comentario', required: false, descripcion: 'Lo que escribio (informativo)', ejemplo: 'Excelente fijacion' },
      { key: 'fotos', required: false, descripcion: 'URLs de las fotos separadas por comas (informativo)', ejemplo: 'https://.../foto.webp' },
      { key: 'estado', required: true, descripcion: 'pendiente, aprobada o rechazada. ESTA es la columna que se puede cambiar', ejemplo: 'aprobada' },
      { key: 'fecha', required: false, descripcion: 'Cuando se escribio (informativo)', ejemplo: '2026-08-01' },
    ],
    notas: [
      'Sirve para MODERAR EN LOTE: exporta las pendientes, escribe aprobada o rechazada en la columna estado y vuelve a subir el archivo.',
      'NO se pueden crear resenas desde un archivo, a proposito: una resena solo existe si esa persona COMPRO ese perfume. Inventarlas seria publicidad enganosa (Ley 1480) y ademas las estrellas dejarian de decirte que fragancia gusto de verdad.',
      'Todo lo demas (comentario, estrellas, fotos) es informativo: se exporta pero al importar no se toca.',
      'La exportacion sirve de respaldo del contenido de tus clientes y para responder un derecho de acceso a datos (Ley 1581 de 2012).',
    ],
  },
  entregas: {
    titulo: 'Fotos de premios entregados',
    columnas: [
      { key: 'id', required: true, descripcion: 'Numero de la entrega (NO cambiar)', ejemplo: 5 },
      { key: 'cliente', required: false, descripcion: 'A quien se le entrego (informativo)', ejemplo: 'Luz Gomez' },
      { key: 'correo', required: false, descripcion: 'Correo del cliente (informativo)', ejemplo: 'luz@correo.com' },
      { key: 'premio', required: false, descripcion: 'Que se entrego (informativo)', ejemplo: 'Perfume 10ml gratis' },
      { key: 'fotos', required: false, descripcion: 'URLs de las fotos separadas por comas (informativo)', ejemplo: 'https://.../foto.webp' },
      { key: 'estado', required: true, descripcion: 'pendiente, aprobada o rechazada. ESTA es la que se puede cambiar', ejemplo: 'aprobada' },
      { key: 'fecha', required: false, descripcion: 'Cuando se entrego (informativo)', ejemplo: '2026-08-01' },
    ],
    notas: [
      'Igual que las resenas: se exporta todo, pero al importar solo se cambia el estado (aprobar o rechazar en lote).',
      'Las fotos las sube el cliente o el admin desde el dashboard; no entran por archivo.',
    ],
  },
  formulas: {
    "titulo": "Recetas por tamano",
    "columnas": [
      {
        "key": "nombre",
        "required": true,
        "descripcion": "Como se llama el tamano",
        "ejemplo": "30 ml"
      },
      {
        "key": "ml_total",
        "required": true,
        "descripcion": "Volumen total en mililitros",
        "ejemplo": 30
      },
      {
        "key": "esencia_ml",
        "required": true,
        "descripcion": "Mililitros de esencia por unidad",
        "ejemplo": 15
      },
      {
        "key": "sellador_ml",
        "required": false,
        "descripcion": "Mililitros de sellador o fijador",
        "ejemplo": 0.4
      },
      {
        "key": "feromonas_ml",
        "required": false,
        "descripcion": "Mililitros de feromonas",
        "ejemplo": 0.3
      },
      {
        "key": "diluyente_ml",
        "required": false,
        "descripcion": "Informativo: es el resto y NO se guarda",
        "ejemplo": 14.3
      },
      {
        "key": "envase",
        "required": false,
        "descripcion": "Insumo tipo envase que usa por defecto",
        "ejemplo": "Envase 30 ml"
      },
      {
        "key": "esencia_defecto",
        "required": false,
        "descripcion": "Informativo: la esencia sale del perfume",
        "ejemplo": ""
      },
      {
        "key": "escalas",
        "required": false,
        "descripcion": "Informativo: precios por cantidad (desde-hasta:precio)",
        "ejemplo": "10-19:18000"
      },
      {
        "key": "activo",
        "required": false,
        "descripcion": "si o no",
        "ejemplo": "si"
      }
    ],
    "notas": [
      "El DILUYENTE nunca se guarda: siempre es ml_total menos esencia, sellador y feromonas. Guardarlo lo desincronizaria al cambiar el volumen.",
      "Si ya existe una receta con ese ml_total se ACTUALIZA; si no, se crea.",
      "La esencia NO se define aqui: cada perfume tiene la suya (Khamrah cuesta el triple que Mandarin Sky por ml).",
      "Los precios por cantidad se editan en \"Tamanos y formulas\"; aqui salen solo para consultarlos."
    ]
  },
  producciones: {
    "titulo": "Lotes producidos",
    "columnas": [
      {
        "key": "fecha",
        "required": true,
        "descripcion": "Cuando se armo el lote",
        "ejemplo": "2026-08-01"
      },
      {
        "key": "fragancia",
        "required": false,
        "descripcion": "Que perfume se armo",
        "ejemplo": "Sauvage 1.1"
      },
      {
        "key": "tamano",
        "required": true,
        "descripcion": "Talla del lote",
        "ejemplo": "30 ml"
      },
      {
        "key": "cantidad",
        "required": true,
        "descripcion": "Unidades armadas",
        "ejemplo": 10
      },
      {
        "key": "costo_unitario",
        "required": false,
        "descripcion": "Lo que costo cada una",
        "ejemplo": 9256
      },
      {
        "key": "costo_total",
        "required": false,
        "descripcion": "Lo que costo el lote",
        "ejemplo": 92560
      },
      {
        "key": "nota",
        "required": false,
        "descripcion": "Nota del lote",
        "ejemplo": ""
      }
    ],
    "notas": [
      "SOLO se exporta: es historico contable y reescribirlo a mano rompe la trazabilidad del inventario.",
      "Los lotes se registran desde la pestana Inventario."
    ]
  },
  cotizaciones: {
    "titulo": "Cotizaciones mayoristas",
    "columnas": [
      {
        "key": "numero",
        "required": true,
        "descripcion": "Numero de la cotizacion",
        "ejemplo": "COT-2026-0001"
      },
      {
        "key": "fecha",
        "required": false,
        "descripcion": "Cuando se emitio",
        "ejemplo": "2026-08-01"
      },
      {
        "key": "tipo",
        "required": false,
        "descripcion": "detallada o general",
        "ejemplo": "detallada"
      },
      {
        "key": "cliente",
        "required": true,
        "descripcion": "A quien se le cotizo",
        "ejemplo": "Distribuidora XYZ"
      },
      {
        "key": "empresa",
        "required": false,
        "descripcion": "Empresa del cliente",
        "ejemplo": ""
      },
      {
        "key": "telefono",
        "required": false,
        "descripcion": "Telefono de contacto",
        "ejemplo": ""
      },
      {
        "key": "estado",
        "required": false,
        "descripcion": "borrador o enviada",
        "ejemplo": "enviada"
      },
      {
        "key": "producto",
        "required": false,
        "descripcion": "Producto de la linea",
        "ejemplo": "Eros"
      },
      {
        "key": "tamano",
        "required": false,
        "descripcion": "Talla de la linea",
        "ejemplo": "30 ml"
      },
      {
        "key": "cantidad",
        "required": false,
        "descripcion": "Unidades de la linea",
        "ejemplo": 50
      },
      {
        "key": "precio_unitario",
        "required": false,
        "descripcion": "Precio por unidad cotizado",
        "ejemplo": 18000
      },
      {
        "key": "subtotal",
        "required": false,
        "descripcion": "Subtotal de la linea",
        "ejemplo": 900000
      },
      {
        "key": "total_cotizacion",
        "required": false,
        "descripcion": "Total de toda la cotizacion",
        "ejemplo": 900000
      }
    ],
    "notas": [
      "SOLO se exporta. Una fila por LINEA: una cotizacion con tres productos ocupa tres filas con el mismo numero.",
      "NO incluye costos ni margenes: eso es interno del admin y nunca sale del dashboard."
    ]
  },
  usuarios: {
    "titulo": "Clientes",
    "columnas": [
      {
        "key": "nombre",
        "required": true,
        "descripcion": "Nombre",
        "ejemplo": "Luz"
      },
      {
        "key": "apellido",
        "required": false,
        "descripcion": "Apellido",
        "ejemplo": "Gomez"
      },
      {
        "key": "correo",
        "required": true,
        "descripcion": "Correo electronico",
        "ejemplo": "luz@correo.com"
      },
      {
        "key": "telefono",
        "required": false,
        "descripcion": "Telefono / WhatsApp",
        "ejemplo": "3001234567"
      },
      {
        "key": "direccion",
        "required": false,
        "descripcion": "Direccion de envio",
        "ejemplo": ""
      },
      {
        "key": "cupo_base",
        "required": false,
        "descripcion": "Cupo de credito base en COP",
        "ejemplo": 0
      },
      {
        "key": "tipo",
        "required": false,
        "descripcion": "ficha (creada por el admin) o cuenta (se registro en la web)",
        "ejemplo": "ficha"
      },
      {
        "key": "activo",
        "required": false,
        "descripcion": "si o no",
        "ejemplo": "si"
      },
      {
        "key": "registrado",
        "required": false,
        "descripcion": "Cuando entro al sistema",
        "ejemplo": "2026-08-01"
      }
    ],
    "notas": [
      "Los administradores NO se exportan.",
      "Es el respaldo de tus contactos y la forma de responder un derecho de acceso a datos (Ley 1581 de 2012)."
    ]
  },
  blog: {
    "titulo": "Entradas del blog",
    "columnas": [
      {
        "key": "titulo",
        "required": true,
        "descripcion": "Titulo de la entrada",
        "ejemplo": "Como elegir tu fragancia"
      },
      {
        "key": "slug",
        "required": true,
        "descripcion": "Direccion en la web",
        "ejemplo": "como-elegir-tu-fragancia"
      },
      {
        "key": "resumen",
        "required": false,
        "descripcion": "Resumen corto",
        "ejemplo": ""
      },
      {
        "key": "publicado",
        "required": false,
        "descripcion": "si o no",
        "ejemplo": "si"
      },
      {
        "key": "fecha",
        "required": false,
        "descripcion": "Cuando se creo",
        "ejemplo": "2026-08-01"
      }
    ],
    "notas": [
      "SOLO se exporta: el contenido lleva HTML que se sanea en el servidor, y meterlo por Excel se saltaria ese filtro.",
      "Sirve de respaldo del listado; el contenido se edita en la pestana Blog."
    ]
  },
  avisos: {
    "titulo": "Avisame cuando vuelva",
    "columnas": [
      {
        "key": "perfume",
        "required": true,
        "descripcion": "Perfume que esperan",
        "ejemplo": "Eros"
      },
      {
        "key": "agotado",
        "required": false,
        "descripcion": "si el perfume sigue agotado",
        "ejemplo": "si"
      },
      {
        "key": "cliente",
        "required": false,
        "descripcion": "Quien lo espera",
        "ejemplo": "Luz Gomez"
      },
      {
        "key": "correo",
        "required": false,
        "descripcion": "Su correo",
        "ejemplo": "luz@correo.com"
      },
      {
        "key": "telefono",
        "required": false,
        "descripcion": "Su WhatsApp",
        "ejemplo": "3001234567"
      },
      {
        "key": "fecha",
        "required": false,
        "descripcion": "Cuando lo pidio",
        "ejemplo": "2026-08-01"
      }
    ],
    "notas": [
      "SOLO se exporta: es la demanda real de reposicion, util para decidir que pedir.",
      "Los avisos los piden los clientes desde la ficha del producto agotado."
    ]
  },
};
