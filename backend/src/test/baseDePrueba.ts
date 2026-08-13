import { prisma } from '../config/prisma';
import { aplicarMovimiento } from '../repositories/inventario.repository';

/**
 * Siembra y limpieza para las pruebas contra base.
 *
 * Criterio: **cada archivo crea los tres o cuatro registros que necesita**. No
 * hay un juego de datos grande compartido, porque cuando una prueba falla el
 * motivo tiene que estar en la misma pantalla — no en lo que dejó otra prueba
 * en otro archivo.
 */

/** Nombre de la base a la que estamos conectados de verdad. */
const nombreDeLaBase = async () => {
  const filas = await prisma.$queryRawUnsafe<{ base: string }[]>('SELECT DATABASE() AS base');
  return filas[0]?.base ?? '';
};

let tablas: string[] | null = null;

/**
 * Vacía todas las tablas.
 *
 * Vuelve a comprobar el nombre de la base ANTES de borrar. El seguro ya está en
 * `prepararBase.ts`, pero esta es la función que de verdad destruye datos y no
 * puede depender de que alguien más lo haya verificado: el día que una prueba
 * se corra con otra configuración, este es el último punto donde se puede parar.
 */
export const limpiarBase = async () => {
  const base = await nombreDeLaBase();
  if (!base.endsWith('_test')) {
    throw new Error(`limpiarBase() cancelada: la conexión apunta a "${base}", que no es una base de pruebas.`);
  }

  if (!tablas) {
    const filas = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.tables
        WHERE table_schema = ? AND table_type = 'BASE TABLE' AND TABLE_NAME <> '_prisma_migrations'`,
      base,
    );
    tablas = filas.map((f) => f.TABLE_NAME);
  }

  // Las llaves foráneas se apagan para no tener que borrar en orden topológico:
  // el orden correcto cambiaría cada vez que se agregue una relación.
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of tablas) await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${t}\``);
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
};

type TipoInsumo = 'materia_prima' | 'envase' | 'accesorio';

/**
 * Un material con su costo de partida y, si se pide, stock inicial.
 *
 * **El stock entra por un movimiento de `ajuste`, no escribiendo la columna.**
 * Así es como se siembra de verdad en el sistema (el conteo físico del modal
 * "Ajustar"), y no es un detalle: `stock` y `precio` son una PROYECCIÓN del
 * libro de movimientos, así que un stock puesto a mano desaparece en cuanto
 * algo obliga a reconstruir desde el libro. Sembrarlo a mano daba una prueba
 * que fallaba culpando al código de un descuadre que había creado la siembra.
 */
export const crearInsumo = async (
  nombre: string,
  opciones: {
    tipo?: TipoInsumo; unidad?: 'ml' | 'unidad'; precio?: number; stock?: number;
    /** Con gama = es una esencia. Es lo que la distingue del diluyente. */
    gama_id?: number;
  } = {},
) => {
  const precio = opciones.precio ?? 0;
  const insumo = await prisma.insumoCosto.create({
    data: {
      nombre,
      tipo: opciones.tipo ?? 'materia_prima',
      unidad: opciones.unidad ?? (opciones.tipo === 'envase' || opciones.tipo === 'accesorio' ? 'unidad' : 'ml'),
      precio,
      stock: 0,
      gama_id: opciones.gama_id ?? null,
    },
  });

  const stock = opciones.stock ?? 0;
  if (stock > 0) {
    await prisma.$transaction((tx) =>
      aplicarMovimiento(tx, {
        insumo_id: insumo.id,
        tipo: 'ajuste',
        cantidad: stock,
        costo_unitario: precio,
        fecha: new Date('2026-08-01'),
        nota: 'Conteo inicial (siembra de prueba)',
      }),
    );
    return prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumo.id } });
  }
  return insumo;
};

/**
 * El escenario de fabricación completo de un 30 ml, con la receta que confirmó
 * el dueño: 15 de esencia, 0,40 de sellador, 0,30 de feromonas y el diluyente
 * como el resto (14,30). El diluyente NUNCA se guarda: se calcula.
 *
 * Los costos son los reales medidos en producción (diluyente $20/ml, sellador y
 * feromonas $100/ml, frasco $2.850, esencia premium $1.500/ml), así que el costo
 * de una unidad da **$25.706** — el mismo desglose documentado de $28.106 menos
 * los $2.400 de accesorios, que aquí no se siembran.
 *
 * Ojo: `recetaDe` busca el diluyente, el sellador y las feromonas **por nombre**
 * (`contains 'iluyente'`, `'ellador'`, `'eromona'`), no por un enlace. Por eso
 * los nombres de aquí no son decorativos: cambiarlos rompe el descuento.
 */
export const sembrarFabricacion30ml = async (opciones: { stock?: number } = {}) => {
  const stock = opciones.stock ?? 1000;

  const esencia = await crearInsumo('Eternity – Esencia', { precio: 1500, stock });
  const diluyente = await crearInsumo('Diluyente', { precio: 20, stock });
  const sellador = await crearInsumo('Sellador', { precio: 100, stock });
  const feromonas = await crearInsumo('Feromonas', { precio: 100, stock });
  const frasco = await crearInsumo('Frasco 30 ml', { tipo: 'envase', precio: 2850, stock });

  const formula = await prisma.formulaVolumen.create({
    data: {
      nombre: '30 ml',
      ml_total: 30,
      esencia_ml: 15,
      sellador_ml: 0.4,
      feromonas_ml: 0.3,
      envase_insumo_id: frasco.id,
    },
  });

  const presentacion = await prisma.presentacion.create({
    data: { nombre: '30ml', ml: 30, formula_volumen_id: formula.id },
  });

  const perfume = await prisma.perfume.create({
    data: {
      nombre: 'Eternity',
      precio: 60000,
      tipo_producto: 'fabricado',
      insumo_esencia_id: esencia.id,
    },
  });

  return { esencia, diluyente, sellador, feromonas, frasco, formula, presentacion, perfume };
};

/** Una campaña de cupón vigente. `max_*` en 0 = sin límite, como en el negocio. */
export const crearCampanaCupon = (
  opciones: { descuento_pct?: number; max_descuento?: number; max_canjes?: number } = {},
) =>
  prisma.anuncio.create({
    data: {
      titulo: 'Campaña de prueba',
      tipo: 'descuento',
      audiencia: 'registrados',
      activo: true,
      descuento_pct: opciones.descuento_pct ?? 10,
      max_descuento: opciones.max_descuento ?? 0,
      max_canjes: opciones.max_canjes ?? 0,
    },
  });

/** Un cliente con cuenta. El rol se crea una sola vez por base limpia. */
export const crearCliente = async (email: string) => {
  const rol = await prisma.role.upsert({
    where: { nombre: 'cliente' },
    update: {},
    create: { nombre: 'cliente' },
  });
  return prisma.user.create({
    data: { nombre: 'Cliente', apellido: 'De Prueba', email, password: 'x', rol_id: rol.id, activo: true },
  });
};

/**
 * Una venta mínima, solo para poder colgarle cosas.
 *
 * Hace falta de verdad: `descuento_codigos.venta_id` SÍ tiene llave foránea
 * (a diferencia de `movimientos_inventario.referencia_id`, que es un número
 * suelto), así que un id inventado revienta al enlazar un cupón.
 */
export const crearVenta = (opciones: { pagada?: boolean; valor?: number } = {}) =>
  prisma.venta.create({
    data: {
      dia: new Date('2026-08-12'),
      persona: 'Cliente de prueba',
      cantidad_perfumes: 1,
      presentacion: '30 ml',
      referencia_perfume: 'Eternity',
      valor_venta: opciones.valor ?? 60000,
      pagada: opciones.pagada ?? true,
    },
  });

/** Lee stock y costo promedio de un material, ya como números. */
export const estadoDe = async (insumoId: number) => {
  const i = await prisma.insumoCosto.findUniqueOrThrow({ where: { id: insumoId } });
  return { stock: Number(i.stock), promedio: Number(i.precio) };
};
