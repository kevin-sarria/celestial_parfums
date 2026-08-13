import type { Perfume } from '../domain/entities/perfume.schema';

/**
 * Qué entra al catálogo PDF y qué se imprime de cada perfume.
 *
 * Vive aparte del generador y son funciones PURAS a propósito: el contador que
 * el modal muestra en vivo ("vas a exportar 137") y el PDF que se genera
 * después tienen que salir del MISMO criterio. Si cada uno filtrara por su
 * cuenta, el número prometido y el documento se separarían el día que alguien
 * toque uno de los dos.
 */

export interface OpcionesCatalogo {
  /** Gamas incluidas (ids de `gamas_esencia`). Vacío = ninguna. */
  gamas: number[];
  /** Incluir los que todavía no tienen esencia asignada (no tienen gama). */
  sinGama: boolean;
  /** Géneros incluidos. Vacío = ninguno. */
  generos: string[];
  /** Incluir los que no tienen género puesto. */
  sinGenero: boolean;
  incluirAgotados: boolean;
  /** Solo los que hoy alcanzan para armar una unidad de su talla más pequeña. */
  soloFabricablesHoy: boolean;
  soloConFoto: boolean;

  // ── Qué se imprime de cada uno ────────────────────────────────────────────
  precio: boolean;
  foto: boolean;
  notas: boolean;
  ocasiones: boolean;
  duracion: boolean;
  genero: boolean;
  /** Una sección por gama, con su título. */
  agruparPorGama: boolean;
  /** Qué poner donde iría el precio cuando se decide no mostrarlo. */
  textoSinPrecio: string;
}

export const OPCIONES_POR_DEFECTO: OpcionesCatalogo = {
  gamas: [], sinGama: true, generos: [], sinGenero: true,
  incluirAgotados: true, soloFabricablesHoy: false, soloConFoto: false,
  precio: true, foto: true, notas: true, ocasiones: true, duracion: true,
  genero: true, agruparPorGama: false, textoSinPrecio: 'Precios por WhatsApp',
};

/** Las gamas que de verdad aparecen en el catálogo, con cuántos perfumes tiene cada una. */
export const gamasDelCatalogo = (perfumes: Perfume[]) => {
  const mapa = new Map<number, { id: number; nombre: string; total: number }>();
  for (const p of perfumes) {
    if (p.gama_id == null || !p.gama) continue;
    const y = mapa.get(p.gama_id);
    if (y) y.total++;
    else mapa.set(p.gama_id, { id: p.gama_id, nombre: p.gama, total: 1 });
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total);
};

/** Motivo por el que un perfume se queda fuera, o null si entra. */
const motivoDeExclusion = (p: Perfume, o: OpcionesCatalogo): string | null => {
  if (p.gama_id == null) {
    if (!o.sinGama) return 'no tienen esencia asignada';
  } else if (!o.gamas.includes(p.gama_id)) {
    return 'no son de las calidades de esencia que elegiste';
  }

  if (p.genero == null) {
    if (!o.sinGenero) return 'no tienen género puesto';
  } else if (!o.generos.includes(p.genero)) {
    return 'no son del género que elegiste';
  }

  if (!o.incluirAgotados && p.agotado) return 'están agotados';
  if (o.soloConFoto && !p.imagen_url) return 'no tienen foto';
  // `sin_esencia` lo calcula el SERVIDOR (mide contra la talla más pequeña de
  // cada perfume). Antes esta regla estaba escrita aquí también, y dos copias
  // de la misma regla se separan el día que alguien toque una.
  if (o.soloFabricablesHoy && p.sin_esencia) {
    return 'no tienes esencia suficiente para armar ni uno';
  }
  return null;
};

export interface SeleccionCatalogo {
  incluidos: Perfume[];
  /** Cuántos quedan fuera y por qué, para poder DECIRLO en vez de que
   *  desaparezcan en silencio (ya nos pasó: el PDF salía con 100 de 212). */
  fuera: { motivo: string; cantidad: number }[];
  total: number;
}

export const seleccionar = (perfumes: Perfume[], o: OpcionesCatalogo): SeleccionCatalogo => {
  const incluidos: Perfume[] = [];
  const porMotivo = new Map<string, number>();

  for (const p of perfumes) {
    const motivo = motivoDeExclusion(p, o);
    if (motivo) porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);
    else incluidos.push(p);
  }

  return {
    incluidos: o.agruparPorGama ? ordenarPorGama(incluidos) : incluidos,
    fuera: [...porMotivo.entries()]
      .map(([motivo, cantidad]) => ({ motivo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad),
    total: perfumes.length,
  };
};

/** Agrupa por gama conservando el orden alfabético dentro de cada una. */
const ordenarPorGama = (perfumes: Perfume[]) =>
  [...perfumes].sort((a, b) => {
    // Los que no tienen gama van al final: son los que están a medio configurar
    const ga = a.gama ?? '￿';
    const gb = b.gama ?? '￿';
    return ga === gb ? a.nombre.localeCompare(b.nombre) : ga.localeCompare(gb);
  });

/**
 * Cómo se llama el archivo y qué dice la portada.
 *
 * Importa más de lo que parece: si mandas solo una parte del catálogo con un
 * documento titulado "Catálogo", el cliente cree que eso es todo lo que vendes.
 */
export const describirSeleccion = (
  o: OpcionesCatalogo, gamas: { id: number; nombre: string }[],
): string => {
  const partes: string[] = [];
  const todasLasGamas = gamas.length > 0 && o.gamas.length === gamas.length && o.sinGama;
  if (!todasLasGamas && o.gamas.length > 0) {
    partes.push(o.gamas.map((id) => gamas.find((g) => g.id === id)?.nombre).filter(Boolean).join(', '));
  }
  if (o.generos.length === 1) {
    partes.push({ dama: 'Dama', caballero: 'Caballero', unisex: 'Unisex' }[o.generos[0]] ?? o.generos[0]);
  }
  if (o.soloFabricablesHoy) partes.push('disponibles');
  return partes.join(' · ');
};

/**
 * Fecha de HOY en Colombia, no en UTC.
 *
 * `toISOString()` da la fecha UTC: pasadas las 7 de la noche ya es el día
 * siguiente allá, y el archivo salía fechado el 10 mientras la portada —que sí
 * usa la hora local— decía 9 de agosto. Dos fechas distintas en el mismo
 * documento. Es el mismo error de zona horaria que ya se corrigió en las
 * estadísticas y en las fechas del dashboard.
 */
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** `catalogo-arabes-dama-2026-08-09.pdf` — para no tener cinco "catalogo.pdf". */
export const nombreArchivo = (descripcion: string) => {
  const hoy = hoyLocal();
  const trozo = descripcion
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `catalogo-celestial-parfums${trozo ? `-${trozo}` : ''}-${hoy}.pdf`;
};
