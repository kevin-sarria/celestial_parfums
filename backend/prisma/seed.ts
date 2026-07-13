/// <reference types="node" />
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // Roles
  const roles = ["ADMIN", "CLIENTE", "PROVEEDOR"];
  for (const nombre of roles) {
    await prisma.role.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  // Tipos de aroma
  const aromas = [
    "Cítrico",
    "Aromático",
    "Floral",
    "Frutal",
    "Coco",
    "Vainilla",
    "Dulce / Gourmand",
    "Amaderado",
    "Almizclado",
    "Atalcado / Empolvado",
    "Tabaco",
    "Cuero",
    "Especiado",
    "Acuático",
    "Ambarado",
  ];
  for (const nombre of aromas) {
    await prisma.tipoAroma.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  // Ocasiones
  const ocasiones = [
    "Día a día",
    "Oficina",
    "Citas",
    "Noche",
    "Fiesta",
    "Elegante",
    "Clima caliente",
    "Clima frío",
    "Gimnasio",
  ];
  for (const nombre of ocasiones) {
    await prisma.ocasion.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  // Categorías
  const categorias = ["1.1", "Contratipo", "Original"];
  for (const nombre of categorias) {
    await prisma.categoria.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  console.log("Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
