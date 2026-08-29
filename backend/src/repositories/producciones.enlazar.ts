import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';
import { tallaDeFormula } from './inventario.terminado';
import { editarProduccion } from './inventario.producciones';
import { crearProductoArmado } from './emparejarEsencias.repository';

/**
 * LOTES POR ENLAZAR: los que dejaron sus frascos en el sitio equivocado, o no
 * los dejaron.
 *
 * La CONSULTA solo lee, y las acciones son las que ya existen —la carga inicial
 * y el PATCH del lote—: un tercer camino para mover frascos sería una tercera
 * versión de la misma regla, y aquí una regla vive en un solo sitio.
 *
 * La única acción propia es `crearFicha11YEnlazar`, que no mueve frascos por su
 * cuenta: crea la ficha que falta y llama a las mismas dos.
 *
 * Ninguna de las dos reglas adivina por el NOMBRE ("dice 1.1"): bastaría un
 * "Set 1.1" o un 1.1 sin esas letras para que la lista mintiera, y una lista
 * que miente en dinero se deja de mirar. Las dos son hechos comprobables.
 */

export interface LotePorEnlazar {
  id: number;
  fecha: string;
  cantidad: number;
  formula_volumen_id: number;
  perfume_id: number | null;
  perfume_nombre: string | null;
  volumen_nombre: string;
  presentacion_id: number | null;
  costo_unitario: number;
  envase_insumo_id: number | null;
  envase_nombre: string | null;
  /** Lo que gastó, en positivo: el PATCH del lote los pide de vuelta. */
  consumos: { insumo_id: number; cantidad: number }[];
  /** `sin_frascos`: nunca entraron. `envase_ajeno`: entraron en la ficha equivocada. */
  motivo: 'sin_frascos' | 'envase_ajeno';
  ficha_sugerida: { id: number; nombre: string } | null;
  /** Cómo se llama la talla ("100ML"), para poder nombrar el precio en pantalla. */
  talla_nombre: string | null;
  /**
   * Precio de la LISTA de los 1.1 para esa talla, o null si esa lista no existe.
   *
   * Es la mitad del arreglo del 2026-08-29: sin este número la ficha nueva nacía
   * con el precio del perfume corriente **sin decírselo a nadie**, y un 1.1 que
   * cuesta el doble se ponía a la venta a precio de contratipo.
   */
  precio_lista_11: number | null;
  /** Lo que vale hoy el perfume CORRIENTE: lo que se heredaría si no hay lista. */
  precio_heredado: number;
  /** Nombre de la categoría 1.1, o null si el dueño todavía no la creó. */
  categoria_11: string | null;
}

export const lotesPorEnlazar = async (): Promise<LotePorEnlazar[]> => {
  const lotes = await prisma.produccion.findMany({
    where: { perfume_id: { not: null } },
    orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
    include: {
      formula: { select: { nombre: true } },
      // `precio` es lo que se heredaría si la lista de los 1.1 no cubre esa talla.
      perfume: { select: { id: true, nombre: true, precio: true } },
    },
  });

  // El envase por defecto de cada tamaño, de una vez: preguntarlo lote a lote
  // serían tantas consultas como lotes en una pantalla que se abre a diario.
  const formulaEnvase = new Map(
    (await prisma.formulaVolumen.findMany({ select: { id: true, envase_insumo_id: true } }))
      .map((f) => [f.id, f.envase_insumo_id]),
  );

  /**
   * La lista de precios de los 1.1, una sola vez para todos los lotes.
   *
   * Se busca la categoría por su nombre porque es como el dueño la creó (no hay
   * una columna "es 1.1"); si todavía no existe, `precio_lista_11` va en null y
   * la pantalla lo dice en rojo en vez de callárselo.
   */
  const categoria11 = await prisma.categoria.findFirst({
    where: { nombre: { contains: '1.1' } },
    include: { precios: { select: { presentacion_id: true, precio: true } } },
  });
  const lista11 = new Map(
    (categoria11?.precios ?? []).map((pr) => [pr.presentacion_id, Number(pr.precio)]),
  );

  const salida: LotePorEnlazar[] = [];

  for (const lote of lotes) {
    if (!lote.perfume) continue;
    const presentacion_id = await tallaDeFormula(lote.formula_volumen_id);
    const frascos = await prisma.movimientoTerminado.count({
      where: { tipo: 'produccion', referencia_id: lote.id },
    });

    const envase = lote.envase_insumo_id
      ? await prisma.insumoCosto.findUnique({
        where: { id: lote.envase_insumo_id }, select: { nombre: true },
      })
      : null;

    /**
     * Lo que ese lote consumió, sacado de su propio libro y en positivo.
     *
     * Viaja a la pantalla porque el PATCH del lote pide el lote ENTERO: si el
     * enlazador mandara solo la ficha nueva, la edición rehacería el lote sin
     * material y la esencia se quedaría devuelta.
     */
    const movimientos = await prisma.movimientoInventario.findMany({
      where: { tipo: 'produccion', referencia_id: lote.id },
      select: { insumo_id: true, cantidad: true },
    });
    const consumos = movimientos.map((m) => ({
      insumo_id: m.insumo_id, cantidad: Math.abs(Number(m.cantidad)),
    }));

    const talla = presentacion_id
      ? await prisma.presentacion.findUnique({
        where: { id: presentacion_id }, select: { nombre: true },
      })
      : null;

    const comun = {
      id: lote.id,
      // Fecha de CALENDARIO: la columna es `@db.Date` y Prisma la lee a
      // medianoche UTC, así que cortar el ISO da el día correcto.
      fecha: lote.fecha.toISOString().slice(0, 10),
      cantidad: lote.cantidad,
      formula_volumen_id: lote.formula_volumen_id,
      perfume_id: lote.perfume.id,
      perfume_nombre: lote.perfume.nombre,
      volumen_nombre: lote.formula?.nombre ?? '',
      presentacion_id,
      costo_unitario: Number(lote.costo_unitario),
      envase_insumo_id: lote.envase_insumo_id,
      envase_nombre: envase?.nombre ?? null,
      consumos,
      talla_nombre: talla?.nombre ?? null,
      precio_lista_11: presentacion_id ? lista11.get(presentacion_id) ?? null : null,
      precio_heredado: Number(lote.perfume.precio),
      categoria_11: categoria11?.nombre ?? null,
    };

    /**
     * ¿Gastó un envase distinto al que manda su fórmula?
     *
     * Es lo que separa un 1.1 de un lote corriente sin adivinar por el nombre:
     * un 1.1 lleva su propio frasco premium, y el lote lo dice al registrarse.
     * Decisión del dueño (2026-08-25) al ver los 6 avisos en producción: el
     * lote del 212 VIP Black usó el envase normal —esos 500 ml están macerando,
     * no son 5 frascos— y no tiene por qué salir aquí. El precio de esconderlo:
     * un lote viejo de perfume corriente cuyos frascos tampoco entraron tampoco
     * se marca.
     */
    const envasePropio = !!lote.envase_insumo_id
      && lote.envase_insumo_id !== formulaEnvase.get(lote.formula_volumen_id);

    // Regla 1: descontó material y no dejó ni un frasco, y lo armó con su envase
    // propio. Son los lotes 1.1 registrados antes de que existiera el libro del
    // terminado.
    if (frascos === 0 && presentacion_id && envasePropio) {
      salida.push({ ...comun, motivo: 'sin_frascos', ficha_sugerida: null });
      continue;
    }

    // Regla 2: el envase que gastó no es el que declara la ficha donde quedaron
    // sus frascos. Es el caso Khamrah, y es un hecho, no una corazonada.
    if (!envasePropio || !presentacion_id) continue;
    const ficha = await prisma.perfumePresentacion.findUnique({
      where: {
        perfume_id_presentacion_id: { perfume_id: lote.perfume.id, presentacion_id },
      },
      select: { envase_insumo_id: true },
    });
    /**
     * Una ficha SIN envase propio no está indefinida: significa "usa el del
     * tamaño" (ver `PerfumePresentacion.envase_insumo_id`). Leerlo como "envase
     * distinto" marcaba como sospechoso a cualquier lote corriente cuya ficha
     * nunca hubiera declarado envase, que son casi todas.
     */
    const envaseDeLaFicha = ficha?.envase_insumo_id ?? formulaEnvase.get(lote.formula_volumen_id);
    if (envaseDeLaFicha === lote.envase_insumo_id) continue;

    // Quién SÍ declara ese envase: esa es la ficha que se propone como destino.
    const candidata = await prisma.perfumePresentacion.findFirst({
      where: {
        envase_insumo_id: lote.envase_insumo_id,
        presentacion_id,
        perfume_id: { not: lote.perfume.id },
      },
      select: { perfume: { select: { id: true, nombre: true } } },
    });

    salida.push({
      ...comun,
      motivo: 'envase_ajeno',
      ficha_sugerida: candidata?.perfume
        ? { id: candidata.perfume.id, nombre: candidata.perfume.nombre }
        : null,
    });
  }

  return salida;
};

/**
 * Manda los frascos de un lote a una ficha: corrige el lote apuntándolo ahí.
 *
 * Sirve para los DOS motivos, y a propósito. Los frascos que nunca entraron
 * podrían sumarse con la carga inicial —el material ya se descontó—, pero eso no
 * deja rastro EN EL LOTE: el aviso lo seguiría marcando como "sin frascos" para
 * siempre, y una lista que no se vacía se deja de mirar. Corregir el lote entra
 * los frascos y además lo saca del aviso, sin mover ni un ml: se le devuelven
 * sus consumos y se le vuelven a descontar los mismos.
 *
 * El costo congelado viaja para que mudar un frasco de ficha no lo revalúe al
 * promedio de hoy.
 */
export const mandarFrascosAlaFicha = async (loteId: number, perfumeId: number) => {
  const lote = await prisma.produccion.findUnique({ where: { id: loteId } });
  if (!lote) throw badRequest('Ese lote ya no existe');

  const consumos = (await prisma.movimientoInventario.findMany({
    where: { tipo: 'produccion', referencia_id: loteId },
    select: { insumo_id: true, cantidad: true },
  })).map((m) => ({ insumo_id: m.insumo_id, cantidad: Math.abs(Number(m.cantidad)) }));

  return editarProduccion(loteId, {
    fecha: lote.fecha.toISOString().slice(0, 10),
    formula_volumen_id: lote.formula_volumen_id,
    cantidad: lote.cantidad,
    perfume_id: perfumeId,
    envase_insumo_id: lote.envase_insumo_id,
    consumos,
    costo_unitario: Number(lote.costo_unitario),
    costo_manual: false,
  });
};

/**
 * Crea la ficha 1.1 que falta y le manda los frascos del lote, de una vez.
 *
 * Es lo que el dueño pidió al ver el aviso en producción: los seis lotes le
 * pedían elegir una ficha 1.1 **que no existía** —229 perfumes y cero 1.1—, así
 * que el desplegable estaba vacío y el aviso no servía para nada.
 *
 * La ficha nace copiando la del perfume corriente (foto incluida), marcada como
 * 1.1 y **apagada**: aparece en *Productos* para que él le ponga lo suyo —foto
 * propia, precio, notas— sin que ningún cliente la vea a medio llenar.
 *
 * No mueve frascos por su cuenta: llama a `mandarFrascosAlaFicha`, que es el
 * mismo camino que usa el botón de enlazar a una ficha que ya existe. Una regla,
 * un sitio.
 */
export const crearFicha11YEnlazar = async (loteId: number, nombre: string, precio?: number) => {
  const lote = await prisma.produccion.findUnique({
    where: { id: loteId },
    include: { perfume: { select: { id: true, precio: true, insumo_esencia_id: true } } },
  });
  if (!lote || !lote.perfume) throw badRequest('Ese lote ya no existe o no dice qué fragancia se armó');

  const presentacion_id = await tallaDeFormula(lote.formula_volumen_id);
  if (!presentacion_id) throw badRequest('Ese tamaño no tiene una talla del catálogo a la que enganchar los frascos');

  // La categoría "1.1" es la que hace que la ficha tome el precio de la lista de
  // los 1.1. Si el dueño todavía no la creó, la ficha nace sin categoría y él la
  // pone luego: mejor eso que inventar una categoría a sus espaldas.
  const categoria = await prisma.categoria.findFirst({
    where: { nombre: { contains: '1.1' } },
    include: { precios: { where: { presentacion_id }, select: { precio: true } } },
  });
  const deLaLista = categoria?.precios[0] ? Number(categoria.precios[0].precio) : null;

  /**
   * EL PRECIO CON EL QUE NACE, Y POR QUÉ NO SIEMPRE SE GUARDA (2026-08-29).
   *
   * Antes se copiaba el precio del perfume corriente y ahí moría el asunto: si
   * la lista de los 1.1 no cubría esa talla, un frasco que cuesta el doble salía
   * a precio de contratipo **sin que nada lo dijera**. Ahora la pantalla enseña
   * el número antes de crear y él puede cambiarlo.
   *
   * Y lo que se guarda depende de si se aparta de la lista o no:
   *
   * - **Acepta el de la lista** → la ficha NO guarda precio propio. Así, el día
   *   que suba la lista de los 1.1, esta ficha sube con todas.
   * - **Escribe otro** → ese número se guarda como excepción de esa talla, y la
   *   lista deja de mandarle. Es lo que hace falta para los Bon Bon y Yum Yum,
   *   que valen más que el resto de 1.1.
   * - **No hay lista todavía** → tampoco se guarda precio propio: el número va al
   *   precio de respaldo de la ficha, así que el día que él cree la lista, esta
   *   ficha la sigue sola en vez de quedarse anclada para siempre.
   */
  const precioFinal = precio ?? deLaLista ?? Number(lote.perfume.precio);
  const esExcepcion = deLaLista != null && precioFinal !== deLaLista;

  const ficha = await crearProductoArmado({
    nombre,
    precio: precioFinal,
    precio_presentacion: esExcepcion ? precioFinal : null,
    presentacion_id,
    envase_insumo_id: lote.envase_insumo_id,
    insumo_esencia_id: lote.perfume.insumo_esencia_id,
    categoria_id: categoria?.id ?? null,
    copiar_de_perfume_id: lote.perfume.id,
  });

  await mandarFrascosAlaFicha(loteId, ficha.id);

  return { ...ficha, presentacion_id };
};
