/**
 * Inferencia del perfume del catálogo a partir de la referencia libre de una venta.
 *
 * En el excel histórico la misma fragancia aparece escrita de muchas formas
 * ("sublime", "bade al oud sublime", "Sublime 30ml"). La estrategia es
 * conservadora: solo se enlaza cuando hay UN candidato claro; ante ambigüedad
 * se deja sin enlazar antes que enlazar mal.
 */

// Palabras sin valor distintivo en nombres de perfumes (conectores y tamaños).
// OJO: no incluir "al"/"el" árabes-transliterados sería ideal, pero "al" y "el"
// también son conectores en español; se resuelve comparando AMBOS lados sin ellas.
const STOPWORDS = new Set(['de', 'del', 'la', 'las', 'los', 'by', 'the', 'para', 'con', 'y', 'e', 'in', 'of']);
const SIZE_RE = /^\d+\s*ml$/;

/** minúsculas, sin tildes, solo letras/números separados por espacios */
export const normalizeName = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (s: string): string[] =>
  normalizeName(s)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t) && !SIZE_RE.test(t.replace(/\s/g, '')));

export interface PerfumeIndexEntry {
  id: number;
  normalizado: string;
  tokens: Set<string>;
}

export const buildPerfumeIndex = (perfumes: { id: number; nombre: string }[]): PerfumeIndexEntry[] =>
  perfumes.map((p) => ({
    id: p.id,
    normalizado: tokenize(p.nombre).join(' '),
    tokens: new Set(tokenize(p.nombre)),
  }));

const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

/**
 * Devuelve el id del perfume que corresponde a la referencia, o null si no hay
 * un candidato inequívoco.
 *
 * 1. Igualdad exacta de nombre normalizado.
 * 2. Contención de tokens en cualquier dirección ("sublime" ⊆ "bade al oud
 *    sublime"), solo si hay UN único candidato: con dos o más perfumes que
 *    contengan la referencia se considera ambiguo y no se enlaza.
 */
export const matchPerfume = (referencia: string, index: PerfumeIndexEntry[]): number | null => {
  const refTokens = new Set(tokenize(referencia));
  if (refTokens.size === 0) return null;
  const refNorm = [...refTokens].join(' ');

  const exact = index.filter((p) => p.normalizado === refNorm);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) return null;

  const candidatos = index.filter(
    (p) => p.tokens.size > 0 && (isSubset(refTokens, p.tokens) || isSubset(p.tokens, refTokens)),
  );
  return candidatos.length === 1 ? candidatos[0].id : null;
};

/**
 * Una venta de combo referencia varios perfumes en un solo texto
 * ("invictus, sauvage y 1 million"). Primero se intenta el texto completo
 * (por si el nombre real contiene separadores) y, si no, se divide por
 * comas/;/+/" y " y se enlaza cada parte por separado.
 */
export const matchPerfumes = (referencia: string, index: PerfumeIndexEntry[]): number[] => {
  const completo = matchPerfume(referencia, index);
  if (completo != null) return [completo];

  const partes = referencia
    .split(/[,;+]|\sy\s/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (partes.length <= 1) return [];

  const ids = new Set<number>();
  for (const parte of partes) {
    const id = matchPerfume(parte, index);
    if (id != null) ids.add(id);
  }
  return [...ids];
};
