import { jsPDF } from 'jspdf';
import type { Perfume } from '../domain/entities/perfume.schema';
import { GENERO_LABELS } from '../domain/entities/perfume.schema';
import { aromaColor } from '../domain/entities/aroma.colors';
import { finalPrice } from '@/lib/format';
import { BASE_URL } from '../infrastructure/api/client';

/**
 * Catálogo de perfumes en PDF, generado en el navegador para compartir por
 * WhatsApp: portada con la marca, un producto por fila (foto, nombre, precio,
 * notas con los colores de la paleta y ocasiones) y marca de agua en cada página.
 */

const MARCA = 'Celestial Parfums';
const PAGE_W = 210; // A4 vertical, en mm
const PAGE_H = 297;
const MARGIN = 14;
const ROW_H = 34;
const INK: [number, number, number] = [43, 37, 60];
const IRIS: [number, number, number] = [91, 74, 138];
const MUTED: [number, number, number] = [120, 115, 130];
const MARFIL: [number, number, number] = [250, 248, 242];

const hexToRgb = (hex: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return MUTED;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** hsl(...) del fallback de aromas → rgb, vía canvas (resuelve cualquier CSS color). */
const cssToRgb = (color: string): [number, number, number] => {
  if (color.startsWith('#')) return hexToRgb(color);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
};

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

/** Descarga una imagen y la devuelve como JPEG pequeño (o null si falla). */
const cargarImagen = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 12000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const MAX = 240;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d')!;
        // Fondo blanco: los PNG transparentes no deben quedar negros en JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch {
        resolve(null); // canvas contaminado (CORS): el PDF sigue sin esa foto
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });

const marcaDeAgua = (doc: jsPDF) => {
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.06 }));
  doc.setFont('helvetica', 'bolditalic');
  doc.setFontSize(46);
  doc.setTextColor(...IRIS);
  for (const y of [90, 180, 270]) {
    doc.text(MARCA, PAGE_W / 2, y, { align: 'center', angle: 24 });
  }
  doc.restoreGraphicsState();
};

const piePagina = (doc: jsPDF, pagina: number) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(MARCA + ' · Catálogo de perfumes', MARGIN, PAGE_H - 7);
  doc.text(String(pagina), PAGE_W - MARGIN, PAGE_H - 7, { align: 'right' });
};

const portada = (doc: jsPDF, totalPerfumes: number) => {
  doc.setFillColor(...MARFIL);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  marcaDeAgua(doc);
  doc.setFont('times', 'italic');
  doc.setFontSize(40);
  doc.setTextColor(...INK);
  doc.text(MARCA, PAGE_W / 2, 120, { align: 'center' });
  doc.setDrawColor(...IRIS);
  doc.setLineWidth(0.6);
  doc.line(PAGE_W / 2 - 30, 130, PAGE_W / 2 + 30, 130);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(...IRIS);
  doc.text('Catálogo de perfumes', PAGE_W / 2, 142, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`${totalPerfumes} fragancias · ${fecha}`, PAGE_W / 2, 152, { align: 'center' });
};

const chip = (doc: jsPDF, x: number, y: number, texto: string, bg: string, fg: string): number => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const w = doc.getTextWidth(texto) + 4.4;
  doc.setFillColor(...cssToRgb(bg));
  doc.roundedRect(x, y - 3.4, w, 4.9, 2.4, 2.4, 'F');
  doc.setTextColor(...cssToRgb(fg));
  doc.text(texto, x + 2.2, y);
  return w;
};

const filaPerfume = (doc: jsPDF, p: Perfume, foto: string | null, y: number) => {
  const xTexto = MARGIN + 30;

  doc.setDrawColor(232, 228, 220);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y + ROW_H - 3, PAGE_W - MARGIN, y + ROW_H - 3);

  // Foto sobre recuadro blanco
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(235, 231, 224);
  doc.roundedRect(MARGIN, y, 25, ROW_H - 6, 2, 2, 'FD');
  if (foto) {
    try { doc.addImage(foto, 'JPEG', MARGIN + 1.5, y + 1.5, 22, ROW_H - 9); } catch { /* sin foto */ }
  }

  // Nombre + categoría + género
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  const nombre = doc.splitTextToSize(p.nombre, 105)[0] as string;
  doc.text(nombre, xTexto, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const meta = [
    p.categoria,
    p.genero ? GENERO_LABELS[p.genero] : null,
    p.duracion ? `Duración ${p.duracion}` : null,
  ].filter(Boolean).join('  ·  ');
  if (meta) doc.text(meta, xTexto, y + 10.5);

  // Notas con su color
  let x = xTexto;
  const yChips = y + 16.5;
  for (const a of p.tipos_aroma.slice(0, 6)) {
    const c = aromaColor(a);
    const w = chip(doc, x, yChips, a, c.bg, c.fg);
    x += w + 1.6;
    if (x > PAGE_W - MARGIN - 40) break;
  }

  // Ocasiones
  if (p.ocasiones.length > 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    const ocas = doc.splitTextToSize(`Ocasiones: ${p.ocasiones.join(', ')}`, 120)[0] as string;
    doc.text(ocas, xTexto, y + 23.5);
  }

  // Precio a la derecha (con tachado si hay descuento). Con varias tallas a
  // distinto precio se anuncia el más barato como "desde".
  const precio = finalPrice(p.precio, p.descuento);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...IRIS);
  const etiqueta = p.varios_precios ? `desde ${formatCOP(precio)}` : formatCOP(precio);
  doc.text(etiqueta, PAGE_W - MARGIN, y + 7, { align: 'right' });
  if (p.descuento > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const original = formatCOP(p.precio);
    const w = doc.getTextWidth(original);
    doc.text(original, PAGE_W - MARGIN, y + 12, { align: 'right' });
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.25);
    doc.line(PAGE_W - MARGIN - w, y + 11, PAGE_W - MARGIN, y + 11);
    doc.setFontSize(7.5);
    doc.setTextColor(...IRIS);
    doc.text(`-${p.descuento}%`, PAGE_W - MARGIN, y + 16.5, { align: 'right' });
  }
  if (p.agotado) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 60, 60);
    doc.text('AGOTADO', PAGE_W - MARGIN, y + 21, { align: 'right' });
  }
};

export const generarCatalogoPdf = async (onProgress: (msg: string) => void): Promise<void> => {
  onProgress('Cargando catálogo…');
  const res = await fetch(`${BASE_URL}/api/parfums/?page=1&limit=1000`);
  const json = await res.json();
  const perfumes: Perfume[] = (json.data ?? []).filter((p: Perfume) => !p.agotado || true);
  if (!perfumes.length) throw new Error('El catálogo está vacío');

  // Fotos en tandas de 8 para no saturar el navegador
  const fotos = new Map<number, string | null>();
  for (let i = 0; i < perfumes.length; i += 8) {
    const tanda = perfumes.slice(i, i + 8);
    onProgress(`Preparando fotos… ${Math.min(i + 8, perfumes.length)}/${perfumes.length}`);
    const cargadas = await Promise.all(
      tanda.map((p) => (p.imagen_url ? cargarImagen(p.imagen_url) : Promise.resolve(null))),
    );
    tanda.forEach((p, idx) => fotos.set(p.id, cargadas[idx]));
  }

  onProgress('Armando PDF…');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  portada(doc, perfumes.length);

  const porPagina = Math.floor((PAGE_H - MARGIN * 2 - 14) / ROW_H);
  let pagina = 1;
  perfumes.forEach((p, i) => {
    const enPagina = i % porPagina;
    if (enPagina === 0) {
      doc.addPage();
      pagina++;
      doc.setFillColor(...MARFIL);
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
      marcaDeAgua(doc);
      doc.setFont('times', 'italic');
      doc.setFontSize(13);
      doc.setTextColor(...INK);
      doc.text(MARCA, MARGIN, MARGIN);
      doc.setDrawColor(...IRIS);
      doc.setLineWidth(0.4);
      doc.line(MARGIN, MARGIN + 2.5, MARGIN + 24, MARGIN + 2.5);
      piePagina(doc, pagina);
    }
    filaPerfume(doc, p, fotos.get(p.id) ?? null, MARGIN + 10 + enPagina * ROW_H);
  });

  doc.save(`catalogo-celestial-parfums-${new Date().toISOString().slice(0, 10)}.pdf`);
};
