import { buildPerfumeIndex, matchPerfume } from '../utils/perfumeMatcher';
import { prisma } from '../config/prisma';
import { badRequest } from '../utils/httpError';

/**
 * Emparejar esencias con su perfume del catálogo — la puesta al día.
 *
 * El alta desde una compra ya deja enlazada toda esencia NUEVA, pero no hace
 * nada con las que ya estaban en el sistema. Aquí se salda ese atraso.
 *
 * Y no es cosmético: un perfume sin esencia enlazada **no descuenta nada del
 * inventario al venderse y su costo entra en CERO**, así que la ganancia del
 * mes sale inflada y el material se va del estante sin que nadie lo note.
 *
 * REGLA DE ORO: esto PROPONE, nunca aplica solo. Se midió contra los datos
 * reales y de 29 esencias el emparejador acierta unas 19, se queda corto en 7 y
 * duda en 3 — pero entre esas 19 hay propuestas equivocadas (una esencia
 * llamada por la marca, una variante "Night" contra un perfume "Black"). Un
 * enlace errado descuenta la fragancia que no era y falsea el costo en
 * silencio, que es peor que no tener enlace.
 */

/** Palabras que no distinguen una fragancia de otra. */
const RUIDO = new Set([
  'by', 'de', 'del', 'la', 'el', 'the', 'of', 'para', 'pour', 'homme', 'femme',
  'eau', 'edp', 'edt', 'parfum', 'perfume', 'esencia', 'esencias', 'dama', 'damas',
  'caballero', 'caballeros', 'men', 'women', 'man', 'woman', 'her', 'him',
  'for', 'and', 'y',
]);

const palabras = (s: string) => s
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .split(' ')
  .filter((w) => w && !RUIDO.has(w));

/**
 * Parecido entre dos nombres, de 0 a 1 (coeficiente de Dice sobre palabras).
 *
 * Se compara por PALABRAS y no por el texto entero porque los dos lados están
 * escritos al revés: "Hugo Boss Bottled – Esencia" contra "Boss Bottled By Hugo
 * Boss". Buscar una cadena dentro de la otra fallaba en casi todos los casos
 * (7 aciertos de 29); con palabras sube a 19.
 */
const parecido = (a: string, b: string) => {
  const A = palabras(a);
  const B = new Set(palabras(b));
  if (!A.length || !B.size) return 0;
  const comunes = A.filter((w) => B.has(w)).length;
  return (2 * comunes) / (A.length + B.size);
};

/** "Eros Caballero – Esencia" → "Eros Caballero". */
export const sinSufijoEsencia = (s: string) =>
  s.replace(/\s*[–—-]\s*esencias?\s*$/i, '').replace(/^\s*esencias?\s+(de\s+)?/i, '').trim();

const MINIMO_PARECIDO = 0.34;
/** Diferencia con el segundo a partir de la cual el primero se considera claro. */
const VENTAJA_CLARA = 0.15;

export interface CandidatoPerfume {
  id: number;
  nombre: string;
  genero: string | null;
  parecido: number;
}

export interface EsenciaPendiente {
  insumo_id: number;
  esencia: string;
  /** El nombre sin el "– Esencia": el que llevaría el perfume si se crea. */
  fragancia: string;
  gama: string | null;
  genero: string | null;
  stock: number;
  candidatos: CandidatoPerfume[];
  /** Hay un candidato destacado y nadie más se lo disputa. */
  claro: boolean;
  /** Otra esencia apunta al MISMO perfume: hay que decidir a mano. */
  conflicto: boolean;
}

/**
 * Qué esencias no tienen perfume y con cuál podrían emparejarse.
 *
 * Solo se ofrecen como candidatos los perfumes que **todavía no tienen
 * esencia**. Esa regla sola resuelve las ambigüedades que parecían irresolubles:
 * "Eros Caballero" tenía dos candidatos (Eros y Eros Flame), pero Eros Flame ya
 * tiene la suya, así que queda uno. Igual con "Toy 2" y "Toy 2 Bubble Gum".
 */
export const proponerEmparejamientos = async (): Promise<EsenciaPendiente[]> => {
  const [esencias, libres] = await Promise.all([
    prisma.insumoCosto.findMany({
      where: {
        activo: true,
        gama_id: { not: null },
        esencia_de_perfumes: { none: {} },
      },
      include: { gama: true },
      orderBy: { nombre: 'asc' },
    }),
    prisma.perfume.findMany({
      where: { tipo_producto: 'fabricado', insumo_esencia_id: null },
      select: { id: true, nombre: true, genero: true },
    }),
  ]);

  const filas: EsenciaPendiente[] = esencias.map((e) => {
    const fragancia = sinSufijoEsencia(e.nombre);
    const candidatos = libres
      .map((p) => ({
        id: p.id, nombre: p.nombre, genero: p.genero as string | null,
        parecido: Math.round(parecido(fragancia, p.nombre) * 100) / 100,
      }))
      .filter((p) => p.parecido >= MINIMO_PARECIDO)
      // El género DESCARTA, nunca elige: si los dos lo tienen y no coinciden,
      // ese perfume no puede ser. Es lo que evita proponerle a "360 Dama" un
      // par de perfumes que son de caballero.
      .filter((p) => !(e.genero && p.genero && e.genero !== p.genero))
      .sort((a, b) => b.parecido - a.parecido)
      .slice(0, 4);

    const claro = candidatos.length === 1
      || (candidatos.length > 1 && candidatos[0].parecido - candidatos[1].parecido > VENTAJA_CLARA);

    return {
      insumo_id: e.id,
      esencia: e.nombre,
      fragancia,
      gama: e.gama?.nombre ?? null,
      genero: e.genero as string | null,
      stock: Number(e.stock),
      candidatos,
      claro,
      conflicto: false,
    };
  });

  /**
   * Dos esencias que apuntan al MISMO perfume.
   *
   * Pasa de verdad: "Carolina Herrera Dama" y "Good Girl Blush" señalan las dos
   * a "Good Girl By Carolina Herrera". Sin marcarlo, aplicar ambas dejaría que
   * la segunda pise a la primera y una esencia quedaría enlazada a un perfume
   * que no es suyo, sin que nadie se entere.
   */
  const cuantasQuieren = new Map<number, number>();
  for (const f of filas) {
    const mejor = f.candidatos[0];
    if (mejor) cuantasQuieren.set(mejor.id, (cuantasQuieren.get(mejor.id) ?? 0) + 1);
  }
  for (const f of filas) {
    const mejor = f.candidatos[0];
    if (mejor && (cuantasQuieren.get(mejor.id) ?? 0) > 1) {
      f.conflicto = true;
      f.claro = false;
    }
  }

  return filas;
};

/**
 * Deja el perfume de esta esencia listo: lo enlaza si ya existe o lo crea como
 * borrador (fuera de la tienda) si no.
 *
 * Vive aquí y no en el módulo de costeo porque lo usan los dos caminos por los
 * que una esencia consigue su perfume: el alta desde una compra y esta puesta
 * al día.
 */
export const enlazarOCrearPerfume = async (
  insumoId: number, nombre: string, genero: 'dama' | 'caballero' | 'unisex' | null,
) => {
  const clave = palabras(nombre).join(' ');
  const existentes = await prisma.perfume.findMany({
    select: { id: true, nombre: true, insumo_esencia_id: true },
  });
  const yaEsta = existentes.find((p) => palabras(p.nombre).join(' ') === clave);

  if (yaEsta) {
    // Si ya tiene esencia NO se le cambia: alguien la eligió a mano y su
    // decisión manda (mismo criterio que el enlazador masivo).
    if (yaEsta.insumo_esencia_id) {
      return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'ya_tenia' as const };
    }
    await prisma.perfume.update({
      where: { id: yaEsta.id }, data: { insumo_esencia_id: insumoId },
    });
    return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'enlazado' as const };
  }

  const creado = await prisma.perfume.create({
    data: {
      nombre,
      // Sin precio, sin foto y sin categoría: es una ficha a medio llenar, y
      // publicarla así se vería peor que no tenerla.
      precio: 0,
      publicado: false,
      tipo_producto: 'fabricado',
      insumo_esencia_id: insumoId,
      genero,
    },
  });
  return { id: creado.id, nombre: creado.nombre, accion: 'creado' as const };
};

/**
 * Deja el ACCESORIO de este material listo para venderse.
 *
 * Hermano de `enlazarOCrearPerfume`, y separado a propósito porque un accesorio
 * no es una fragancia: se compra hecho (`comprado`), sale del inventario por su
 * PROPIO material (`insumo_producto_id`, no `insumo_esencia_id`), no tiene
 * receta ni talla, y **nace con precio de venta**, porque un producto en cero
 * no se puede meter en una venta sin regalarlo.
 *
 * Nace FUERA de la tienda (`publicado: false`): el dueño decide accesorio por
 * accesorio si además quiere venderlo suelto en el catálogo público. El
 * buscador de Registrar venta lo ve igual, publicado o no.
 *
 * Si ya hay un producto con ese nombre **no se toca**. Convertir una ficha
 * existente a "accesorio comprado" porque coincide el nombre es justo como se
 * corrompen los datos: se devuelve `ya_existe` y que el dueño decida.
 */
export const enlazarOCrearAccesorio = async (
  insumoId: number, nombre: string, precioVenta: number,
) => {
  const clave = palabras(nombre).join(' ');
  const existentes = await prisma.perfume.findMany({
    select: { id: true, nombre: true, insumo_producto_id: true, es_accesorio: true },
  });
  const yaEsta = existentes.find((p) => palabras(p.nombre).join(' ') === clave);

  if (yaEsta) {
    // Ya es el accesorio de ESTE material: no hay nada que hacer.
    if (yaEsta.es_accesorio && yaEsta.insumo_producto_id === insumoId) {
      return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'ya_tenia' as const };
    }
    return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'ya_existe' as const };
  }

  const creado = await prisma.perfume.create({
    data: {
      nombre,
      precio: precioVenta,
      publicado: false,
      tipo_producto: 'comprado',
      es_accesorio: true,
      insumo_producto_id: insumoId,
    },
  });
  return { id: creado.id, nombre: creado.nombre, accion: 'creado' as const };
};

/**
 * EL TERCER HERMANO: dar de alta un 1.1 sin salir de donde se está armando.
 *
 * Los otros dos crean el producto que sale de una esencia (`enlazarOCrearPerfume`)
 * y el que se revende tal cual (`enlazarOCrearAccesorio`). Este crea el que se
 * arma antes de venderse. Nace de una barrera medida: el dueño tenía 5 frascos
 * 1.1 sin ficha porque darlos de alta obligaba a salir a otra pantalla y llenar
 * 16 campos, doce de los cuales no le aplican a un 1.1.
 *
 * Pide lo mínimo para que el frasco tenga costo y se pueda vender —nombre,
 * precio, su talla y su envase—; el resto de la ficha (foto, notas, descripción)
 * se llena después desde Productos, y mientras tanto **nadie lo ve**: nace
 * apagado, como sus dos hermanos.
 *
 * Un 1.1 puede ser preparado por el dueño (gasta su esencia) o comprado ya hecho
 * (`comprado: true`). Los dos son 1.1 —envase premium, precio propio y solo se
 * venden si hay unidades—; lo único que cambia es de dónde sale su costo.
 */
export const crearProductoArmado = async (datos: {
  nombre: string;
  precio: number;
  /** La talla que se arma. Su envase se engancha AQUÍ, no en la receta del tamaño. */
  presentacion_id: number;
  envase_insumo_id?: number | null;
  /** Solo si lo prepara el dueño: la esencia con la que se cuesta. */
  insumo_esencia_id?: number | null;
  /** true = lo compra ya hecho, así que no gasta esencia suya. */
  comprado?: boolean;
  categoria_id?: number | null;
  /** "Es el 1.1 de este perfume": se COPIA su ficha (no se enlaza). */
  copiar_de_perfume_id?: number | null;
}) => {
  const nombre = datos.nombre.trim();
  if (!nombre) throw badRequest('Ponle un nombre al producto (por ejemplo "Bon Bon 1.1")');
  if (!(datos.precio > 0)) throw badRequest('Ponle el precio al que lo vendes');

  const clave = palabras(nombre).join(' ');
  const existentes = await prisma.perfume.findMany({ select: { id: true, nombre: true } });
  const yaEsta = existentes.find((p) => palabras(p.nombre).join(' ') === clave);
  // No se toca lo que ya existe: se avisa y decide el dueño. Es la misma regla
  // de los otros dos hermanos, y lo que evita acabar con "Bon Bon 1.1" y
  // "bon bón 1.1" como dos fichas con el stock partido.
  if (yaEsta) return { id: yaEsta.id, nombre: yaEsta.nombre, accion: 'ya_existe' as const };

  /**
   * La ficha se COPIA del perfume corriente, no se enlaza a él.
   *
   * Un 1.1 y su corriente son el mismo jugo: descripción, notas, ocasiones,
   * género, duración y proyección son idénticas, y volver a escribirlas es
   * justo la fricción que tiene al dueño con 229 perfumes y cero fichas 1.1.
   * Copia y no enlace porque son dos productos que se venden distinto: el día
   * que se separen, un enlace vivo obligaría a decidir cuál manda.
   *
   * Se copia en el SERVIDOR para que el alta por Excel y por API hereden igual,
   * por la misma razón por la que `naceComoProducto` vive aquí y no en el
   * formulario.
   */
  const origen = datos.copiar_de_perfume_id
    ? await prisma.perfume.findUnique({
      where: { id: datos.copiar_de_perfume_id },
      include: {
        tipos_aroma: { select: { tipo_aroma_id: true } },
        ocasiones: { select: { ocasion_id: true } },
      },
    })
    : null;

  const creado = await prisma.perfume.create({
    data: {
      nombre,
      precio: datos.precio,
      publicado: false,
      solo_armado: true,
      tipo_producto: datos.comprado ? 'comprado' : 'fabricado',
      categoria_id: datos.categoria_id ?? null,
      insumo_esencia_id: datos.comprado ? null : (datos.insumo_esencia_id ?? null),
      // Lo que comparten los dos. El precio, la foto y el envase NO: eso es lo
      // único que de verdad cambia entre un 1.1 y su corriente.
      descripcion: origen?.descripcion ?? null,
      duracion: origen?.duracion ?? null,
      proyeccion: origen?.proyeccion ?? null,
      genero: origen?.genero ?? null,
      // La FOTO también se hereda (decisión del dueño, 2026-08-25): es el mismo
      // jugo y el mismo frasco de referencia, así que una ficha 1.1 sin imagen
      // se vería rota en la tienda por una diferencia que al cliente no le
      // importa. Se cambia luego si él le toma una foto propia.
      imagen_url: origen?.imagen_url ?? null,
      ...(origen?.tipos_aroma.length
        ? { tipos_aroma: { create: origen.tipos_aroma.map((t) => ({ tipo_aroma_id: t.tipo_aroma_id })) } }
        : {}),
      ...(origen?.ocasiones.length
        ? { ocasiones: { create: origen.ocasiones.map((o) => ({ ocasion_id: o.ocasion_id })) } }
        : {}),
      presentaciones: {
        create: {
          presentacion_id: datos.presentacion_id,
          envase_insumo_id: datos.envase_insumo_id ?? null,
        },
      },
    },
  });
  return { id: creado.id, nombre: creado.nombre, accion: 'creado' as const };
};

export interface AccionEmparejar {
  insumo_id: number;
  /** Enlazar con este perfume que ya existe. */
  perfume_id?: number;
  /** O crear un borrador con este nombre. */
  crear?: string;
}

/**
 * Aplica lo que el dueño confirmó, una acción por esencia.
 *
 * Se valida cada enlace contra la base en vez de confiar en lo que llega: entre
 * que se pintó la pantalla y se pulsó el botón, alguien pudo asignarle esa
 * esencia a otro perfume desde otra pestaña.
 */
export const aplicarEmparejamientos = async (acciones: AccionEmparejar[]) => {
  if (!acciones.length) throw badRequest('No elegiste ninguna esencia');

  const resultado = { enlazados: 0, creados: 0, omitidos: [] as string[] };

  for (const a of acciones) {
    const insumo = await prisma.insumoCosto.findUnique({
      where: { id: a.insumo_id },
      select: { id: true, nombre: true, genero: true, tipo: true },
    });
    if (!insumo) { resultado.omitidos.push(`El insumo ${a.insumo_id} ya no existe`); continue; }
    // Apuntar un perfume a un envase daría un costo por ml sin sentido
    if (insumo.tipo !== 'materia_prima') {
      resultado.omitidos.push(`"${insumo.nombre}" no es materia prima`);
      continue;
    }

    if (a.perfume_id) {
      const p = await prisma.perfume.findUnique({
        where: { id: a.perfume_id },
        select: { id: true, nombre: true, insumo_esencia_id: true },
      });
      if (!p) { resultado.omitidos.push(`El perfume ${a.perfume_id} ya no existe`); continue; }
      if (p.insumo_esencia_id) {
        resultado.omitidos.push(`"${p.nombre}" ya tiene esencia asignada: no se tocó`);
        continue;
      }
      await prisma.perfume.update({
        where: { id: p.id }, data: { insumo_esencia_id: insumo.id },
      });
      resultado.enlazados++;
      continue;
    }

    const nombre = (a.crear ?? '').trim().slice(0, 150);
    if (!nombre) { resultado.omitidos.push(`"${insumo.nombre}" no traía qué hacer`); continue; }
    const r = await enlazarOCrearPerfume(
      insumo.id, nombre, (insumo.genero as 'dama' | 'caballero' | 'unisex' | null) ?? null,
    );
    if (r.accion === 'creado') resultado.creados++;
    else if (r.accion === 'enlazado') resultado.enlazados++;
    else resultado.omitidos.push(`"${r.nombre}" ya tenía esencia: no se tocó`);
  }

  return resultado;
};

/**
 * Sugerir y aplicar enlaces perfume→esencia EN BLOQUE.
 *
 * Vivían en `perfume.repository.ts`, pero son el mismo trabajo que el resto de
 * este archivo —averiguar qué esencia le toca a cada perfume— y usan el mismo
 * matcher conservador. Juntarlas evita que dos sitios distintos decidan lo
 * mismo con criterios que se separen con el tiempo.
 */
/**
 * Propone qué esencia le corresponde a cada perfume, SIN aplicar nada.
 *
 * Nace de cómo el dueño cargó sus datos: cada esencia se llama
 * "‹Fragancia› – Esencia", así que el nombre ya dice a qué perfume pertenece.
 * Enlazarlas a mano serían 200+ visitas.
 *
 * Usa el MISMO matcher que las ventas, que es conservador a propósito: si un
 * nombre encaja con dos perfumes, no elige — prefiere dejarlo sin enlazar a
 * enlazarlo mal, porque un enlace equivocado descuenta la esencia de otro y el
 * costo sale falso sin que nadie lo note.
 *
 * Solo mira perfumes fabricados que AÚN no tienen esencia: nunca pisa una
 * asignación hecha a mano.
 */
export const sugerirEsencias = async () => {
  const [perfumes, esencias] = await Promise.all([
    prisma.perfume.findMany({
      where: { tipo_producto: 'fabricado', insumo_esencia_id: null },
      select: { id: true, nombre: true },
    }),
    prisma.insumoCosto.findMany({
      where: { tipo: 'materia_prima', activo: true },
      select: { id: true, nombre: true },
    }),
  ]);

  const index = buildPerfumeIndex(perfumes);
  const enlaces: { perfume_id: number; perfume: string; insumo_id: number; esencia: string }[] = [];
  const yaPropuesto = new Set<number>();

  for (const e of esencias) {
    // El nombre de la esencia lleva el del perfume delante del separador
    const corto = e.nombre.split(' – ')[0].split(' - ')[0].trim();
    if (!corto || corto.length < 3) continue;
    const perfumeId = matchPerfume(corto, index);
    if (!perfumeId || yaPropuesto.has(perfumeId)) continue;
    yaPropuesto.add(perfumeId);
    enlaces.push({
      perfume_id: perfumeId,
      perfume: perfumes.find((p) => p.id === perfumeId)!.nombre,
      insumo_id: e.id,
      esencia: e.nombre,
    });
  }

  return {
    enlaces: enlaces.sort((a, b) => a.perfume.localeCompare(b.perfume)),
    // Los que habrá que poner a mano después
    sin_sugerencia: perfumes.filter((p) => !yaPropuesto.has(p.id)).length,
    perfumes_pendientes: perfumes.length,
  };
};

/**
 * Aplica una lista de enlaces perfume→esencia de una sola vez.
 *
 * Se valida que cada insumo sea materia prima: apuntar un perfume a un envase
 * daría un costo por ml sin sentido.
 */
export const aplicarEnlacesEsencia = async (
  enlaces: { perfume_id: number; insumo_esencia_id: number }[],
) => {
  const ids = [...new Set(enlaces.map((e) => e.insumo_esencia_id))];
  const validos = await prisma.insumoCosto.findMany({
    where: { id: { in: ids }, tipo: 'materia_prima' },
    select: { id: true },
  });
  const permitidos = new Set(validos.map((v) => v.id));
  const malos = ids.filter((id) => !permitidos.has(id));
  if (malos.length > 0) {
    throw badRequest(`${malos.length} de los insumos elegidos no son materia prima`);
  }

  return prisma.$transaction(async (tx) => {
    let count = 0;
    for (const e of enlaces) {
      const r = await tx.perfume.updateMany({
        // Solo si sigue sin esencia: si alguien la puso mientras revisabas la
        // vista previa, su decisión manda sobre la sugerencia automática.
        where: { id: e.perfume_id, insumo_esencia_id: null },
        data: { insumo_esencia_id: e.insumo_esencia_id },
      });
      count += r.count;
    }
    return count;
  });
};
