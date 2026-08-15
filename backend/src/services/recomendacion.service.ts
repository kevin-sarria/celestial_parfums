import { prisma } from '../config/prisma';
import { SOLO_PUBLICADOS } from '../repositories/perfume.repository';
import { mapPerfume, perfumeInclude, sinExistenciasParaUno } from '../repositories/perfume.mapeo';
import { FiltrosRecomendacion } from '../schemas/recomendacion.schema';

/**
 * Motor de "Tu perfume ideal": puntúa cada perfume del catálogo contra las
 * respuestas del quiz. Solo los criterios respondidos entran al cálculo, así
 * el porcentaje de afinidad siempre es relativo a lo que la persona contó.
 * El resultado se guarda por usuario y NO se recalcula al volver al apartado.
 */

const PESOS = {
  aromas: 30,
  ocasiones: 25,
  genero: 10,
  presupuesto: 10,
  categorias: 10,
  edad: 8,
  intensidad: 7,
} as const;
const PESO_POPULARIDAD = 5;

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Familias olfativas que suelen preferirse por rango de edad (heurística suave)
const AROMAS_POR_EDAD: Record<string, string[]> = {
  '18-25': ['dulce', 'frutal', 'citric', 'fresco', 'vainilla', 'caramelo', 'tropical'],
  '26-35': ['fresco', 'aromatic', 'floral', 'citric', 'especiado', 'marino'],
  '36-50': ['amaderado', 'oriental', 'especiado', 'cuero', 'ambar', 'tabaco'],
  '50+': ['amaderado', 'oriental', 'cuero', 'tabaco', 'ambar', 'almizcle', 'clasico'],
};

const PROYECCION_POR_INTENSIDAD: Record<string, string[]> = {
  suave: ['suave', 'baja', 'ligera', 'intima', 'discreta', 'moderada'],
  media: ['media', 'moderada', 'normal', 'equilibrada'],
  fuerte: ['alta', 'fuerte', 'intensa', 'pesada', 'potente', 'bestial'],
};

const GENERO_LABEL: Record<string, string> = {
  dama: 'para ella', caballero: 'para él', unisex: 'unisex',
};

interface Puntuado {
  perfume: any;
  puntaje: number;
  razones: string[];
  ventas: number;
}

const puntuar = (p: any, f: FiltrosRecomendacion, maxVentas: number): Puntuado | null => {
  const razones: string[] = [];
  const ventas = p._count?.ventas ?? 0;
  let posible = PESO_POPULARIDAD;
  let ganado = maxVentas > 0 ? (ventas / maxVentas) * PESO_POPULARIDAD : 0;

  // Género: lo contrario al pedido se descarta; unisex siempre puede
  if (f.genero) {
    posible += PESOS.genero;
    if (p.genero === f.genero) {
      ganado += PESOS.genero;
      razones.push(`Pensado ${GENERO_LABEL[f.genero]}`);
    } else if (p.genero === 'unisex' || !p.genero) {
      ganado += PESOS.genero * 0.6;
      if (p.genero === 'unisex') razones.push('Unisex: le queda a cualquiera');
    } else {
      return null;
    }
  }

  const nombresAroma: string[] = p.tipos_aroma.map((r: any) => r.tipo_aroma.nombre);

  if (f.aromas?.length) {
    posible += PESOS.aromas;
    const idsPerfume = new Set(p.tipos_aroma.map((r: any) => r.tipo_aroma.id));
    const coinciden = f.aromas.filter((id) => idsPerfume.has(id));
    ganado += (PESOS.aromas * coinciden.length) / f.aromas.length;
    if (coinciden.length) {
      const nombres = p.tipos_aroma
        .filter((r: any) => coinciden.includes(r.tipo_aroma.id))
        .map((r: any) => r.tipo_aroma.nombre);
      razones.push(`Notas que amas: ${nombres.join(', ')}`);
    }
  }

  if (f.ocasiones?.length) {
    posible += PESOS.ocasiones;
    const idsPerfume = new Set(p.ocasiones.map((r: any) => r.ocasion.id));
    const coinciden = f.ocasiones.filter((id) => idsPerfume.has(id));
    ganado += (PESOS.ocasiones * coinciden.length) / f.ocasiones.length;
    if (coinciden.length) {
      const nombres = p.ocasiones
        .filter((r: any) => coinciden.includes(r.ocasion.id))
        .map((r: any) => r.ocasion.nombre);
      razones.push(`Perfecto para ${nombres.join(', ')}`);
    }
  }

  if (f.presupuesto) {
    posible += PESOS.presupuesto;
    const precioFinal = Number(p.precio) * (1 - (p.descuento ?? 0) / 100);
    if (precioFinal <= f.presupuesto) {
      ganado += PESOS.presupuesto;
      razones.push('Dentro de tu presupuesto');
    } else if (precioFinal <= f.presupuesto * 1.15) {
      ganado += PESOS.presupuesto * 0.5; // apenas se pasa: aún vale mostrarlo
    }
  }

  if (f.categorias?.length) {
    posible += PESOS.categorias;
    if (p.categoria_id && f.categorias.includes(p.categoria_id)) {
      ganado += PESOS.categorias;
      if (p.categoria?.nombre) razones.push(`Categoría ${p.categoria.nombre}`);
    }
  }

  if (f.edad) {
    posible += PESOS.edad;
    const claves = AROMAS_POR_EDAD[f.edad] ?? [];
    const match = nombresAroma.some((n) => claves.some((k) => normalizar(n).includes(k)));
    if (match) {
      ganado += PESOS.edad;
      razones.push('Notas muy pedidas en tu rango de edad');
    }
  }

  if (f.intensidad) {
    posible += PESOS.intensidad;
    const claves = PROYECCION_POR_INTENSIDAD[f.intensidad] ?? [];
    const proy = normalizar(p.proyeccion ?? '');
    if (proy && claves.some((k) => proy.includes(k))) {
      ganado += PESOS.intensidad;
      razones.push(f.intensidad === 'suave' ? 'Proyección discreta' : f.intensidad === 'fuerte' ? 'Proyección que se nota' : 'Proyección equilibrada');
    }
  }

  if (ventas >= 3) razones.push('Entre los más vendidos');

  return { perfume: p, puntaje: Math.round((100 * ganado) / posible), razones, ventas };
};

const MAX_RESULTADOS = 10;
const MIN_RESULTADOS = 5;
const PUNTAJE_MINIMO = 20;

export const calcularRecomendaciones = async (userId: number, filtros: FiltrosRecomendacion) => {
  const todos = await prisma.perfume.findMany({
    // Ni agotados ni fuera del catálogo: no tiene sentido recomendar algo que
    // el cliente no puede comprar ni siquiera ver.
    where: { agotado: false, ...SOLO_PUBLICADOS },
    include: { ...perfumeInclude, _count: { select: { ventas: true } } },
  });
  // El `agotado` de arriba es solo la marca MANUAL, que es lo único que sabe
  // filtrar la consulta. Quedarse ahí recomendaría justo lo que no se puede
  // entregar, que es el caso más caro: el cliente hace el quiz, se ilusiona
  // con la fragancia y toca decirle que no hay.
  const perfumes = todos.filter((p) => !sinExistenciasParaUno(p));
  const maxVentas = Math.max(0, ...perfumes.map((p) => p._count.ventas));

  const puntuados = perfumes
    .map((p) => puntuar(p, filtros, maxVentas))
    .filter((x): x is Puntuado => x !== null)
    .sort((a, b) => b.puntaje - a.puntaje || b.ventas - a.ventas);

  // Top 10 con afinidad razonable; nunca menos de 5 si el catálogo alcanza
  const conAfinidad = puntuados.filter((x) => x.puntaje >= PUNTAJE_MINIMO);
  const top = (conAfinidad.length >= MIN_RESULTADOS ? conAfinidad : puntuados).slice(0, MAX_RESULTADOS);

  // Se guarda el cálculo: al volver al apartado se muestra tal cual
  const rec = await prisma.recomendacion.upsert({
    where: { user_id: userId },
    update: { filtros: filtros as any, items: { deleteMany: {} } },
    create: { user_id: userId, filtros: filtros as any },
  });
  await prisma.recomendacionItem.createMany({
    data: top.map((x, i) => ({
      recomendacion_id: rec.id,
      perfume_id: x.perfume.id,
      orden: i,
      puntaje: Math.min(100, Math.max(0, x.puntaje)),
      razones: JSON.stringify(x.razones),
    })),
  });

  return getRecomendacion(userId);
};

/** El cálculo guardado del usuario (null si aún no hace el quiz). */
export const getRecomendacion = async (userId: number) => {
  const rec = await prisma.recomendacion.findUnique({
    where: { user_id: userId },
    include: {
      items: {
        orderBy: { orden: 'asc' },
        include: { perfume: { include: perfumeInclude } },
      },
    },
  });
  if (!rec) return null;
  return {
    filtros: rec.filtros,
    calculado_en: rec.updated_at,
    items: rec.items.map((it) => ({
      ...mapPerfume(it.perfume),
      puntaje: it.puntaje,
      razones: JSON.parse(it.razones) as string[],
    })),
  };
};
