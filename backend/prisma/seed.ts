/// <reference types="node" />
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();

async function main() {
  // Roles
  const roles = ['ADMIN', 'CLIENTE', 'PROVEEDOR'];
  for (const nombre of roles) {
    await prisma.role.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Tipos de aroma
  const aromas = ['Dulce', 'Cítrico', 'Amaderado', 'Fresco', 'Aromático', 'Oriental', 'Floral'];
  for (const nombre of aromas) {
    await prisma.tipoAroma.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Ocasiones
  const ocasiones = ['Diario', 'Oficina', 'Citas', 'Noche', 'Eventos', 'Calor', 'Frio'];
  for (const nombre of ocasiones) {
    await prisma.ocasion.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Categorías
  const categorias = ['1.1', 'Contratipo', 'Original'];
  for (const nombre of categorias) {
    await prisma.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } });
  }

  // Fetch IDs for relations
  const aromaMap = Object.fromEntries(
    (await prisma.tipoAroma.findMany({ select: { id: true, nombre: true } })).map((a) => [a.nombre, a.id])
  );
  const ocasionMap = Object.fromEntries(
    (await prisma.ocasion.findMany({ select: { id: true, nombre: true } })).map((o) => [o.nombre, o.id])
  );
  const categoriaMap = Object.fromEntries(
    (await prisma.categoria.findMany({ select: { id: true, nombre: true } })).map((c) => [c.nombre, c.id])
  );

  // Perfumes
  const perfumes = [
    {
      nombre: 'Acqua Di Gio',
      precio: 120000,
      descripcion: 'Fresco marino clásico',
      genero: 'hombre' as const,
      categoria: 'Contratipo',
      aromas: ['Cítrico', 'Fresco'],
      ocasiones: ['Diario', 'Calor'],
    },
    {
      nombre: '9PM Afnan',
      precio: 130000,
      descripcion: 'Dulce nocturno potente',
      genero: 'hombre' as const,
      categoria: 'Original',
      aromas: ['Dulce', 'Oriental'],
      ocasiones: ['Noche', 'Citas'],
    },
    {
      nombre: 'Sauvage Dior',
      precio: 150000,
      descripcion: 'Aromático moderno versátil',
      genero: 'hombre' as const,
      categoria: 'Original',
      aromas: ['Aromático'],
      ocasiones: ['Diario', 'Oficina', 'Noche'],
    },
    {
      nombre: 'Valentino Uomo Born in Roma',
      precio: 160000,
      descripcion: 'Elegante y dulce',
      genero: 'hombre' as const,
      categoria: 'Contratipo',
      aromas: ['Dulce', 'Oriental'],
      ocasiones: ['Citas', 'Noche', 'Eventos'],
    },
    {
      nombre: 'Lacoste Blanca',
      precio: 110000,
      descripcion: 'Fresco limpio diario',
      genero: 'mujer' as const,
      categoria: '1.1',
      aromas: ['Fresco'],
      ocasiones: ['Diario', 'Oficina'],
    },
  ];

  for (const p of perfumes) {
    const existing = await prisma.perfume.findFirst({ where: { nombre: p.nombre } });
    if (!existing) {
      await prisma.perfume.create({
        data: {
          nombre:       p.nombre,
          precio:       p.precio,
          descripcion:  p.descripcion,
          genero:       p.genero,
          categoria_id: categoriaMap[p.categoria],
          tipos_aroma:  { create: p.aromas.map((a) => ({ tipo_aroma_id: aromaMap[a] })) },
          ocasiones:    { create: p.ocasiones.map((o) => ({ ocasion_id: ocasionMap[o] })) },
        },
      });
    }
  }

  console.log('Seed completado.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
