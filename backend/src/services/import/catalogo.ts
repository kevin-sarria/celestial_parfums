import { prisma } from '../../config/prisma';
import { clampPct, fmtDate, lowerMap, splitList, toBool, toNullNum, toNullStr, toNum, toStr, Celda, FilaExcel } from './core';
import type { EntityImportResult } from './core';
import { textoDeError } from '../../utils/errorSeguro';
// La regla que separa Perfumes de Productos vive en un solo sitio.
import { WHERE_FAMILIA, type FamiliaProducto } from '../../repositories/perfume.familia';

/**
 * Importación/exportación del catálogo: perfumes, precios, combos y descuentos.
 *
 * Separado de `import.service.ts` para respetar la regla de ~500 líneas.
 * Cada función recibe las filas ya leídas y acumula el resultado.
 */

/**
 * Filas de exportación por entidad del catálogo (null = no es de este módulo).
 *
 * `familia` acota "perfumes" a una de las dos pestañas del dashboard. Sin ella
 * se exporta la tabla entera, que es lo correcto para el resto de la aplicación
 * (Excel de todo el catálogo, plantillas, respaldos).
 */
export const exportarCatalogo = async (entity: string, familia?: FamiliaProducto): Promise<FilaExcel[] | null> => {
  if (entity === 'perfumes') {
    const perfumes = await prisma.perfume.findMany({
      where: familia ? WHERE_FAMILIA[familia] : undefined,
      orderBy: { nombre: 'asc' },
      include: {
        categoria: true,
        tipos_aroma: { include: { tipo_aroma: true } },
        ocasiones: { include: { ocasion: true } },
        presentaciones: { include: { presentacion: true } },
      },
    });
    return perfumes.map(p => ({
      nombre: p.nombre,
      precio: Number(p.precio),
      descripcion: p.descripcion ?? '',
      duracion: p.duracion ?? '',
      proyeccion: p.proyeccion ?? '',
      genero: p.genero ?? '',
      categoria: p.categoria?.nombre ?? '',
      image_url: p.imagen_url ?? '',
      tipos_aroma: p.tipos_aroma.map(t => t.tipo_aroma.nombre).join(', '),
      ocasiones: p.ocasiones.map(o => o.ocasion.nombre).join(', '),
      presentaciones: p.presentaciones.map(pr => pr.presentacion.nombre).join(', '),
      // Solo las tallas con precio propio (las demas heredan el de la lista)
      precios_presentacion: p.presentaciones
        .filter(pr => pr.precio != null)
        .map(pr => `${pr.presentacion.nombre}=${Number(pr.precio)}`)
        .join(', '),
      esencia_premium: p.esencia_premium ? 'si' : 'no',
      descuento: p.descuento,
    }));
  }

  if (entity === 'precios') {
    const filas = await prisma.precioLista.findMany({
      include: { categoria: true, presentacion: true },
      orderBy: [{ categoria: { nombre: 'asc' } }, { presentacion: { nombre: 'asc' } }],
    });
    return filas.map(f => ({
      categoria: f.categoria.nombre,
      presentacion: f.presentacion.nombre,
      precio: Number(f.precio),
    }));
  }

  if (entity === 'combos') {
    const combos = await prisma.combo.findMany({ orderBy: { nombre: 'asc' }, include: { categoria: true } });
    return combos.map(c => ({
      nombre: c.nombre,
      precio: Number(c.precio),
      cantidad: c.cantidad,
      descripcion: c.descripcion ?? '',
      categoria: c.categoria?.nombre ?? '',
      image_url: c.imagen_url ?? '',
      descuento: c.descuento,
      activo: c.activo ? 'si' : 'no',
    }));
  }

  if (entity === 'descuentos') {
    const [perfumes, combos] = await Promise.all([
      prisma.perfume.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true, descuento: true } }),
      prisma.combo.findMany({ orderBy: { nombre: 'asc' }, select: { nombre: true, descuento: true } }),
    ]);
    return [
      ...perfumes.map(p => ({ tipo: 'perfume', nombre: p.nombre, descuento: p.descuento })),
      ...combos.map(c => ({ tipo: 'combo', nombre: c.nombre, descuento: c.descuento })),
    ];
  }

  return null;
};

/** Importadores del catálogo. Devuelve true si la entidad es de este módulo. */
export const importarCatalogo = async (
  entity: string, rows: FilaExcel[], result: EntityImportResult,
): Promise<boolean> => {
  if (entity === 'perfumes') {
    const [aromas, ocasiones, presentaciones, categorias] = await Promise.all([
      prisma.tipoAroma.findMany(), prisma.ocasion.findMany(),
      prisma.presentacion.findMany(), prisma.categoria.findMany(),
    ]);
    const aromaMap = lowerMap(aromas);
    const ocasionMap = lowerMap(ocasiones);
    const presMap = lowerMap(presentaciones);
    /**
     * Insumos por nombre, para las columnas `envase` y `esencia` de los 1.1.
     * Sin ellas un 1.1 importado entraba como un perfume corriente: publicado,
     * sin envase premium y sin la regla de "solo se vende si está armado".
     */
    const insumoMap = lowerMap(await prisma.insumoCosto.findMany({ select: { id: true, nombre: true } }));
    const catMap = lowerMap(categorias);
    const ids = (val: Celda, map: Map<string, number>) =>
      [...new Set(splitList(val).map(n => map.get(n.toLowerCase())).filter((x): x is number => x != null))];

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (toStr(r['precio']) === '' || isNaN(Number(r['precio']))) {
        result.errores.push(`Fila ${fila} (${nombre}): el precio es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      // Acepta la terminologia nueva y traduce la antigua (hombre/mujer) por compatibilidad
      const generoRaw = toStr(r['genero']).toLowerCase();
      const generoStr = generoRaw === 'hombre' ? 'caballero' : generoRaw === 'mujer' ? 'dama' : generoRaw;
      // Excepciones de precio por talla: "30ML=60000, 100ML=150000"
      const propios = new Map<number, number>();
      for (const parte of splitList(r['precios_presentacion'])) {
        const [talla, valor] = parte.split('=').map(s => s.trim());
        const presId = presMap.get((talla ?? '').toLowerCase());
        const num = Number(valor);
        if (presId != null && !isNaN(num) && num > 0) propios.set(presId, num);
      }
      // Un 1.1: se arma antes de venderse y lleva su envase propio.
      const soloArmado = toBool(r['solo_armado'], false);
      const nombreEnvase = toStr(r['envase']);
      const nombreEsencia = toStr(r['esencia']);
      const envaseId = nombreEnvase ? insumoMap.get(nombreEnvase.toLowerCase()) ?? null : null;
      const esenciaId = nombreEsencia ? insumoMap.get(nombreEsencia.toLowerCase()) ?? null : null;
      // Se avisa pero NO se tumba la fila: la ficha sirve igual y el dueño la
      // completa después. En silencio, ese 1.1 costaría como uno corriente.
      if (nombreEnvase && !envaseId) result.errores.push(`Fila ${fila} (${nombre}): no encontre el envase "${nombreEnvase}"; la ficha se creo sin el`);
      if (nombreEsencia && !esenciaId) result.errores.push(`Fila ${fila} (${nombre}): no encontre la esencia "${nombreEsencia}"; la ficha se creo sin ella`);

      try {
        await prisma.perfume.create({
          data: {
            nombre,
            descripcion: toNullStr(r['descripcion']),
            precio: toNum(r['precio']),
            duracion: toNullStr(r['duracion']),
            proyeccion: toNullStr(r['proyeccion']),
            imagen_url: toNullStr(r['image_url']),
            genero: generoStr === 'dama' || generoStr === 'caballero' || generoStr === 'unisex' ? generoStr : null,
            categoria_id: catMap.get(toStr(r['categoria']).toLowerCase()) ?? null,
            descuento: clampPct(r['descuento']),
            esencia_premium: toBool(r['esencia_premium'], false),
            solo_armado: soloArmado,
            insumo_esencia_id: esenciaId,
            // Un producto nace apagado; un perfume normal, publicado. Misma
            // regla que el alta por pantalla (ver perfume.familia.ts).
            publicado: !soloArmado,
            tipos_aroma: { create: ids(r['tipos_aroma'], aromaMap).map(id => ({ tipo_aroma_id: id })) },
            ocasiones: { create: ids(r['ocasiones'], ocasionMap).map(id => ({ ocasion_id: id })) },
            presentaciones: {
              create: ids(r['presentaciones'], presMap).map(id => ({
                presentacion_id: id,
                precio: propios.get(id) ?? null,
                // El envase premium se engancha a la talla, que es donde manda
                // sobre el de la receta del tamaño.
                envase_insumo_id: envaseId,
              })),
            },
          },
        });
        result.insertados++;
      } catch (e) {
        result.errores.push(`Fila ${fila} (${nombre}): ${textoDeError(e)}`);
        result.omitidos++;
      }
    }
    return true;
  }

  // ── Combos ──────────────────────────────────────────────────────────────────
  if (entity === 'combos') {
    const categorias = await prisma.categoria.findMany();
    const catMap = lowerMap(categorias);

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (toStr(r['precio']) === '' || isNaN(Number(r['precio']))) {
        result.errores.push(`Fila ${fila} (${nombre}): el precio es obligatorio y debe ser numerico`); result.omitidos++; continue;
      }
      const cantidad = toNum(r['cantidad']);
      if (cantidad < 1) { result.errores.push(`Fila ${fila} (${nombre}): la cantidad debe ser mayor a 0`); result.omitidos++; continue; }
      const activoStr = toStr(r['activo']).toLowerCase();
      try {
        await prisma.combo.create({
          data: {
            nombre,
            descripcion: toNullStr(r['descripcion']),
            imagen_url: toNullStr(r['image_url']),
            categoria_id: catMap.get(toStr(r['categoria']).toLowerCase()) ?? null,
            cantidad,
            precio: toNum(r['precio']),
            descuento: clampPct(r['descuento']),
            activo: !['no', 'false', '0'].includes(activoStr),
          },
        });
        result.insertados++;
      } catch (e) {
        result.errores.push(`Fila ${fila} (${nombre}): ${textoDeError(e)}`);
        result.omitidos++;
      }
    }
    return true;
  }

  // ── Lista de precios (categoría × presentación) ─────────────────────────────
  if (entity === 'precios') {
    const [categorias, presentaciones] = await Promise.all([
      prisma.categoria.findMany(), prisma.presentacion.findMany(),
    ]);
    const catMap = lowerMap(categorias);
    const presMap = lowerMap(presentaciones);
    /**
     * Insumos por nombre, para las columnas `envase` y `esencia` de los 1.1.
     * Sin ellas un 1.1 importado entraba como un perfume corriente: publicado,
     * sin envase premium y sin la regla de "solo se vende si está armado".
     */
    const insumoMap = lowerMap(await prisma.insumoCosto.findMany({ select: { id: true, nombre: true } }));

    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const catNombre = toStr(r['categoria']);
      const presNombre = toStr(r['presentacion']);
      const categoriaId = catMap.get(catNombre.toLowerCase());
      const presentacionId = presMap.get(presNombre.toLowerCase());
      if (!categoriaId) { result.errores.push(`Fila ${fila}: no existe la categoria "${catNombre}"`); result.omitidos++; continue; }
      if (!presentacionId) { result.errores.push(`Fila ${fila}: no existe la presentacion "${presNombre}"`); result.omitidos++; continue; }
      const precio = toNum(r['precio']);
      if (precio <= 0) { result.errores.push(`Fila ${fila} (${catNombre} ${presNombre}): el precio debe ser mayor a 0`); result.omitidos++; continue; }

      try {
        const previo = await prisma.precioLista.findUnique({
          where: { categoria_id_presentacion_id: { categoria_id: categoriaId, presentacion_id: presentacionId } },
        });
        await prisma.precioLista.upsert({
          where: { categoria_id_presentacion_id: { categoria_id: categoriaId, presentacion_id: presentacionId } },
          create: { categoria_id: categoriaId, presentacion_id: presentacionId, precio },
          update: { precio },
        });
        if (previo) result.actualizados++; else result.insertados++;
      } catch (e) {
        result.errores.push(`Fila ${fila} (${catNombre} ${presNombre}): ${textoDeError(e)}`);
        result.omitidos++;
      }
    }
    return true;
  }

  // ── Publicidad (anuncios y cupones) ─────────────────────────────────────────

  if (entity === 'descuentos') {
    for (const [i, r] of rows.entries()) {
      const fila = i + 2;
      const tipo = toStr(r['tipo']).toLowerCase();
      const nombre = toStr(r['nombre']);
      if (!nombre) { result.errores.push(`Fila ${fila}: el nombre es obligatorio`); result.omitidos++; continue; }
      if (tipo !== 'perfume' && tipo !== 'combo') {
        result.errores.push(`Fila ${fila} (${nombre}): el tipo debe ser "perfume" o "combo"`); result.omitidos++; continue;
      }
      const descuento = clampPct(r['descuento']);
      try {
        const updated = tipo === 'perfume'
          ? await prisma.perfume.updateMany({ where: { nombre }, data: { descuento } })
          : await prisma.combo.updateMany({ where: { nombre }, data: { descuento } });
        if (updated.count === 0) {
          result.errores.push(`Fila ${fila}: no se encontro ningun ${tipo} llamado "${nombre}"`);
          result.omitidos++;
        } else {
          result.actualizados += updated.count;
        }
      } catch (e) {
        result.errores.push(`Fila ${fila} (${nombre}): ${textoDeError(e)}`);
        result.omitidos++;
      }
    }
    return true;
  }

  // ── Ventas ──────────────────────────────────────────────────────────────────
  return false;
};
