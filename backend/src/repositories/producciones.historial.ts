/**
 * El rastro de las ediciones de un lote, en español y ya redactado.
 *
 * Se guarda el TEXTO y no los ids: un historial de ids obliga a reconstruir
 * nombres que quizá ya no existan (una ficha borrada, un envase renombrado) y
 * acabaría mostrando "perfume #529 → perfume #612", que no le dice nada al
 * dueño. Vive en su propio archivo —y es puro— para poder probar la redacción
 * sin levantar MySQL.
 */

export interface FotoLote {
  /** Fecha de CALENDARIO 'AAAA-MM-DD'. Nunca un instante. */
  fecha: string;
  cantidad: number;
  perfume: string | null;
  volumen: string;
  envase: string | null;
  costo_unitario: number;
  costo_manual: boolean;
}

export interface LineaHistorial { fecha: string; texto: string }

/** $74.580 — el mismo formato de la pantalla, sin decimales. */
const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const sinNombre = (v: string | null) => v ?? 'sin definir';

/**
 * Qué cambió entre el lote de antes y el de ahora, en una sola frase.
 *
 * Cadena vacía = no cambió nada que valga la pena contar, y entonces la edición
 * no escribe línea: un historial lleno de "no pasó nada" se deja de leer.
 */
export const describirCambios = (antes: FotoLote, despues: FotoLote): string => {
  const partes: string[] = [];
  if (antes.fecha !== despues.fecha) partes.push(`fecha ${antes.fecha} → ${despues.fecha}`);
  if (antes.cantidad !== despues.cantidad) partes.push(`${antes.cantidad} → ${despues.cantidad} unidades`);
  if (antes.perfume !== despues.perfume) partes.push(`ficha ${sinNombre(antes.perfume)} → ${sinNombre(despues.perfume)}`);
  if (antes.volumen !== despues.volumen) partes.push(`tamaño ${antes.volumen} → ${despues.volumen}`);
  if (antes.envase !== despues.envase) partes.push(`envase ${sinNombre(antes.envase)} → ${sinNombre(despues.envase)}`);

  if (despues.costo_manual && antes.costo_unitario !== despues.costo_unitario) {
    partes.push(`costo ${pesos(despues.costo_unitario)} puesto a mano`);
  } else if (!despues.costo_manual && Math.round(antes.costo_unitario) !== Math.round(despues.costo_unitario)) {
    // Al peso: los céntimos de un promedio recalculado no son un cambio que
    // contarle a nadie.
    partes.push(`costo ${pesos(antes.costo_unitario)} → ${pesos(despues.costo_unitario)}`);
  }

  return partes.join(' · ');
};

/**
 * Añade una línea al historial guardado, la más nueva primero.
 *
 * La columna es JSON y puede traer cualquier cosa (o nada): lo que no sea una
 * lista se descarta en vez de reventar la edición. Perder el rastro es menos
 * grave que no poder corregir un lote.
 */
export const agregarLinea = (historial: unknown, fecha: string, texto: string): LineaHistorial[] => {
  const previas = Array.isArray(historial)
    ? (historial as LineaHistorial[]).filter((l) => l && typeof l.texto === 'string')
    : [];
  return [{ fecha, texto }, ...previas];
};
