export interface Resena {
  id: number;
  autor: string;
  rating: number;
  comentario: string;
  imagenes: string[];
  fecha: string;
}

/** Cuenta cuántas reseñas hay por cada estrella (índice 0 = 1★ … 4 = 5★). */
export function contarPorEstrella(resenas: Resena[]): number[] {
  const c = [0, 0, 0, 0, 0];
  resenas.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) c[r.rating - 1]++; });
  return c;
}

/** Fecha corta en español a partir de un instante (created_at). */
export function fmtFechaResena(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}
