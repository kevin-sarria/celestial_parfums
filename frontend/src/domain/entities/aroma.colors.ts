/**
 * Paleta de notas olfativas al estilo Fragrantica: cada familia de aroma tiene
 * su color característico (fondo pastel + texto oscuro del mismo tono). Se usa
 * en el detalle del perfume y en el catálogo PDF.
 */
export interface AromaColor {
  bg: string;
  fg: string;
}

const PALETA: Record<string, AromaColor> = {
  'cítrico': { bg: '#FFF3C2', fg: '#8A6D00' },
  'aromático': { bg: '#E2F0E0', fg: '#3F7048' },
  'floral': { bg: '#F9DDEB', fg: '#9D3E6E' },
  'frutal': { bg: '#FFE0DB', fg: '#B4453A' },
  'coco': { bg: '#F7F3E4', fg: '#8C7B50' },
  'vainilla': { bg: '#FFF0D9', fg: '#A9791C' },
  'dulce': { bg: '#FCE1EE', fg: '#C2367C' },
  'gourmand': { bg: '#F3E0D0', fg: '#8B5A2B' },
  'dulce / gourmand': { bg: '#FCE1EE', fg: '#C2367C' },
  'amaderado': { bg: '#EADFD3', fg: '#6B4F35' },
  'almizclado': { bg: '#EFE9F5', fg: '#6E5A8E' },
  'atalcado / empolvado': { bg: '#F2ECF2', fg: '#7E6A7E' },
  'tabaco': { bg: '#E8D9C8', fg: '#6E4A26' },
  'cuero': { bg: '#E5D8D0', fg: '#5C3A28' },
  'especiado': { bg: '#FBE3D4', fg: '#B05323' },
  'acuático': { bg: '#DCEFF7', fg: '#2E6E8E' },
  'ambarado': { bg: '#FAE8CE', fg: '#A5691E' },
  'oriental': { bg: '#F3E2D9', fg: '#94502A' },
};

/** Color pastel determinístico para aromas que el admin cree a futuro. */
const fallback = (nombre: string): AromaColor => {
  let h = 0;
  for (const ch of nombre) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { bg: `hsl(${h} 45% 91%)`, fg: `hsl(${h} 45% 32%)` };
};

export const aromaColor = (nombre: string): AromaColor =>
  PALETA[nombre.trim().toLowerCase()] ?? fallback(nombre);
