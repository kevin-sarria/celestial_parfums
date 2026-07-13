import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Celestial Parfums API',
      version: '1.0.0',
      description: 'API de gestión de perfumes, combos, ventas, créditos y pagos para Celestial Parfums.',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Desarrollo' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'access_token',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            total: { type: 'integer' },
            page: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
        Perfume: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            descripcion: { type: 'string', nullable: true },
            precio: { type: 'number' },
            duracion: { type: 'string', nullable: true },
            proyeccion: { type: 'string', nullable: true },
            imagen_url: { type: 'string', nullable: true },
            genero: { type: 'string', enum: ['dama', 'caballero', 'unisex'], nullable: true },
            categoria: { type: 'string', nullable: true },
            descuento: { type: 'integer' },
            agotado: { type: 'boolean' },
            tipos_aroma: { type: 'array', items: { type: 'string' } },
            ocasiones: { type: 'array', items: { type: 'string' } },
            presentaciones: { type: 'array', items: { type: 'string' } },
          },
        },
        Combo: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            descripcion: { type: 'string', nullable: true },
            imagen_url: { type: 'string', nullable: true },
            categoria: { type: 'string', nullable: true },
            cantidad: { type: 'integer' },
            precio: { type: 'number' },
            descuento: { type: 'integer' },
            activo: { type: 'boolean' },
          },
        },
        Venta: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            dia: { type: 'string', format: 'date' },
            persona: { type: 'string' },
            cantidad_perfumes: { type: 'integer' },
            presentacion: { type: 'string' },
            referencia_perfume: { type: 'string' },
            valor_venta: { type: 'number' },
            datos_adicionales: { type: 'string', nullable: true },
          },
        },
        Credito: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            fecha: { type: 'string', format: 'date' },
            cliente: { type: 'object', properties: { id: { type: 'integer' }, nombre: { type: 'string' }, apellido: { type: 'string' } } },
            articulos: { type: 'string' },
            deuda_inicial: { type: 'number' },
            abonos: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, monto: { type: 'number' }, fecha: { type: 'string', format: 'date' } } } },
            total_abonado: { type: 'number' },
            total_en_deuda: { type: 'number' },
          },
        },
        AuthUser: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            nombre: { type: 'string' },
            apellido: { type: 'string' },
            email: { type: 'string', format: 'email' },
            rol_id: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: ['./src/docs/*.yaml'],
};

export const swaggerSpec = swaggerJsdoc(options);
