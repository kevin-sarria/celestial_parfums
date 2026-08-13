import bcrypt from 'bcryptjs';
import { prisma } from '../src/config/prisma';
import { crearInsumo } from '../src/test/baseDePrueba';

/**
 * La tienda mínima sobre la que corren los recorridos.
 *
 * Se siembra UNA vez, antes de levantar los servidores. No se vuelve a tocar
 * entre archivos: el catálogo público va por caché en memoria del backend, así
 * que resembrarlo con el servidor ya andando dejaría la tienda enseñando datos
 * viejos y los fallos serían fantasmas imposibles de reproducir.
 *
 * Por eso **cada recorrido trabaja sobre su propia categoría**: así ninguno
 * puede desordenarle los precios a otro y el orden de los archivos da igual.
 */

export const ADMIN = { email: 'admin@prueba.local', clave: 'Prueba123!' };

/**
 * Precio de lista de un 30 ml, precio del combo de 3 (más barato que sueltos),
 * el precio propio de la excepción y el nuevo precio que teclea el recorrido.
 */
export const PRECIOS = { unidad: 60000, comboDe3: 150000, propio: 99000, nuevo: 70000 };

const nombresPerfumes = (prefijo: string) =>
  [1, 2, 3, 4].map((n) => `${prefijo} ${n}`);

/**
 * Una categoría con su precio de lista, cuatro perfumes en talla 30 ml y un
 * combo de 3. Cada recorrido pide la suya.
 *
 * **Cada perfume lleva SU esencia con stock de sobra**, y eso no es adorno: un
 * fabricado sin esencia sale AGOTADO en la tienda (regla del 2026-08-12) y una
 * card agotada no tiene botón de agregar. Sembrarlos sin esencia daba una
 * tienda entera de productos que no se pueden comprar.
 */
export const sembrarCategoria = async (
  nombre: string,
  presentacionId: number,
  opciones: { precioPropioDelUltimo?: number } = {},
) => {
  const categoria = await prisma.categoria.create({ data: { nombre } });

  await prisma.precioLista.create({
    data: { categoria_id: categoria.id, presentacion_id: presentacionId, precio: PRECIOS.unidad },
  });

  const perfumes = [];
  for (const nombrePerfume of nombresPerfumes(nombre)) {
    const esencia = await crearInsumo(`${nombrePerfume} – Esencia`, { precio: 400, stock: 1000 });
    const perfume = await prisma.perfume.create({
      data: {
        nombre: nombrePerfume,
        precio: PRECIOS.unidad,
        categoria_id: categoria.id,
        publicado: true,
        tipo_producto: 'fabricado',
        insumo_esencia_id: esencia.id,
      },
    });
    await prisma.perfumePresentacion.create({
      data: { perfume_id: perfume.id, presentacion_id: presentacionId },
    });
    perfumes.push({ ...perfume, esencia });
  }

  // Un perfume con precio PROPIO: la excepción que no se entera cuando cambia
  // la lista de precios de su categoría.
  if (opciones.precioPropioDelUltimo) {
    await prisma.perfumePresentacion.update({
      where: {
        perfume_id_presentacion_id: {
          perfume_id: perfumes[perfumes.length - 1].id,
          presentacion_id: presentacionId,
        },
      },
      data: { precio: opciones.precioPropioDelUltimo },
    });
  }

  const combo = await prisma.combo.create({
    data: {
      nombre: `Combo 3 ${nombre}`,
      categoria_id: categoria.id,
      presentacion_id: presentacionId,
      cantidad: 3,
      precio: PRECIOS.comboDe3,
      activo: true,
    },
  });

  return { categoria, perfumes, combo };
};

/**
 * Deja la base lista: administrador, la talla de 30 ml y una categoría por
 * recorrido. Devuelve lo sembrado para que las pruebas no tengan que adivinar ids.
 */
export const sembrarTienda = async () => {
  // rol_id === 1 es lo que el servidor considera administrador.
  const rolAdmin = await prisma.role.create({ data: { id: 1, nombre: 'admin' } });
  const admin = await prisma.user.create({
    data: {
      nombre: 'Kevin',
      apellido: 'Prueba',
      email: ADMIN.email,
      password: await bcrypt.hash(ADMIN.clave, 10),
      rol_id: rolAdmin.id,
      activo: true,
    },
  });

  // Los materiales generales de la receta. `recetaDe` los busca POR NOMBRE
  // (contiene "iluyente", "ellador", "eromona"), así que estos nombres no son
  // decorativos: sin ellos la venta no descontaría lo que debe.
  await crearInsumo('Diluyente', { precio: 20, stock: 100000 });
  await crearInsumo('Sellador', { precio: 100, stock: 10000 });
  await crearInsumo('Feromonas', { precio: 100, stock: 10000 });
  const frasco = await crearInsumo('Frasco 30 ml', { tipo: 'envase', precio: 2850, stock: 10000 });

  // La receta del 30 ml, enlazada a la talla POR NÚMERO. Hace falta para dos
  // cosas: saber si alcanza la esencia para armar uno (si no, el perfume sale
  // agotado) y saber qué descontar al vender.
  const formula = await prisma.formulaVolumen.create({
    data: {
      nombre: '30 ml', ml_total: 30, esencia_ml: 15, sellador_ml: 0.4, feromonas_ml: 0.3,
      envase_insumo_id: frasco.id,
    },
  });

  const presentacion = await prisma.presentacion.create({
    data: { nombre: '30ml', ml: 30, formula_volumen_id: formula.id },
  });

  const carrito = await sembrarCategoria('Carrito', presentacion.id);
  const precios = await sembrarCategoria('Precios', presentacion.id, {
    precioPropioDelUltimo: PRECIOS.propio,
  });
  const ventas = await sembrarCategoria('Ventas', presentacion.id);

  return { admin, presentacion, carrito, precios, ventas };
};

export type TiendaSembrada = Awaited<ReturnType<typeof sembrarTienda>>;
