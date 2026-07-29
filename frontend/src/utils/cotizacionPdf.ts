import { jsPDF } from 'jspdf';
import type { Cotizacion, CotizacionConfig } from '../domain/entities/cotizacion.types';
import { WHATSAPP_NUMBER } from '../config/constants';

/**
 * Cotización mayorista en PDF con aire de documento empresarial. Se genera en el
 * navegador (jsPDF, sin dependencias nuevas) reusando la identidad del catálogo:
 * marfil + iris, marca de agua sutil y mucho espacio en blanco.
 *
 * REGLA DE ORO: aquí NUNCA se imprime el desglose de costos ni la utilidad.
 * Ese dato es interno; el cliente solo ve producto, cantidad, precio y total.
 */

const MARCA = 'Celestial Parfums';
const PAGE_W = 210; // A4 vertical en mm
const PAGE_H = 297;
const MARGIN = 16;
const INK: [number, number, number] = [43, 37, 60];
const IRIS: [number, number, number] = [91, 74, 138];
const MUTED: [number, number, number] = [120, 115, 130];
const MARFIL: [number, number, number] = [250, 248, 242];
const LINEA: [number, number, number] = [228, 223, 214];

const formatCOP = (v: number) => `$${Math.round(v).toLocaleString('es-CO')}`;

const fmtFecha = (d: Date | string) =>
  new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

const marcaDeAgua = (doc: jsPDF) => {
  doc.saveGraphicsState();
  doc.setGState(doc.GState({ opacity: 0.05 }));
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(52);
  doc.setTextColor(...IRIS);
  doc.text(MARCA, PAGE_W / 2, PAGE_H / 2, { align: 'center', angle: 26 });
  doc.restoreGraphicsState();
};

const piePagina = (doc: jsPDF, pagina: number) => {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(`${MARCA} · Cotización mayorista`, MARGIN, PAGE_H - 8);
  doc.text(String(pagina), PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
};

/** Salta de página cuando el contenido llega al pie. Devuelve la nueva Y. */
const asegurarEspacio = (doc: jsPDF, y: number, alto: number, estado: { pagina: number }): number => {
  if (y + alto < PAGE_H - 20) return y;
  piePagina(doc, estado.pagina);
  doc.addPage();
  estado.pagina += 1;
  doc.setFillColor(...MARFIL);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  marcaDeAgua(doc);
  return MARGIN + 6;
};

const tituloSeccion = (doc: jsPDF, texto: string, y: number): number => {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...IRIS);
  doc.text(texto.toUpperCase(), MARGIN, y);
  doc.setDrawColor(...IRIS);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 1.6, MARGIN + doc.getTextWidth(texto.toUpperCase()), y + 1.6);
  return y + 7;
};

/** Encabezado: marca a la izquierda, datos del documento a la derecha. */
const encabezado = (doc: jsPDF, c: Cotizacion): number => {
  doc.setFillColor(...MARFIL);
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F');
  marcaDeAgua(doc);

  doc.setFont('times', 'italic');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text(MARCA, MARGIN, MARGIN + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text('Perfumería · Esencias premium', MARGIN, MARGIN + 14);

  // Bloque derecho: número, fecha y vigencia
  const xd = PAGE_W - MARGIN;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...IRIS);
  doc.text('COTIZACIÓN', xd, MARGIN + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(c.numero, xd, MARGIN + 12, { align: 'right' });
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(`Emitida: ${fmtFecha(c.fecha)}`, xd, MARGIN + 17.5, { align: 'right' });
  doc.text(`Válida hasta: ${fmtFecha(c.fecha_vigencia)}`, xd, MARGIN + 22, { align: 'right' });

  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, MARGIN + 27, PAGE_W - MARGIN, MARGIN + 27);
  return MARGIN + 36;
};

const datosCliente = (doc: jsPDF, c: Cotizacion, y: number): number => {
  y = tituloSeccion(doc, 'Cliente', y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(c.cliente_empresa || c.cliente_nombre, MARGIN, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const detalles = [
    c.cliente_empresa ? `Contacto: ${c.cliente_nombre}` : null,
    c.cliente_nit ? `NIT/CC: ${c.cliente_nit}` : null,
    c.cliente_telefono,
    c.cliente_email,
  ].filter(Boolean) as string[];
  detalles.forEach((d) => { doc.text(d, MARGIN, y); y += 4.4; });
  return y + 5;
};

/** Tabla de productos: solo lo que el cliente debe ver. */
const tablaProductos = (doc: jsPDF, c: Cotizacion, y: number, estado: { pagina: number }): number => {
  y = tituloSeccion(doc, 'Detalle', y);

  const xCant = 118;
  const xPrecio = 145;
  const xSub = PAGE_W - MARGIN;

  doc.setFillColor(...IRIS);
  doc.rect(MARGIN, y - 4.5, PAGE_W - MARGIN * 2, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('PRODUCTO', MARGIN + 3, y);
  doc.text('CANT.', xCant, y, { align: 'right' });
  doc.text('P. UNITARIO', xPrecio + 16, y, { align: 'right' });
  doc.text('SUBTOTAL', xSub - 3, y, { align: 'right' });
  y += 8;

  c.items.forEach((it) => {
    y = asegurarEspacio(doc, y, 12, estado);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(it.perfume_nombre, 92)[0], MARGIN + 3, y);

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    const extras = it.accesorios_seleccionados.map((a) => a.nombre);
    const detalle = [it.volumen_nombre, ...extras].join(' · ');
    doc.text(doc.splitTextToSize(detalle, 92)[0], MARGIN + 3, y + 4);

    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(String(it.cantidad), xCant, y, { align: 'right' });
    doc.text(formatCOP(it.precio_unitario), xPrecio + 16, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatCOP(it.subtotal), xSub - 3, y, { align: 'right' });

    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.2);
    doc.line(MARGIN, y + 6.5, PAGE_W - MARGIN, y + 6.5);
    y += 11;
  });

  return y + 2;
};

/**
 * Cotización GENERAL: tabla de precios por cantidad, sin fragancias concretas.
 * Sirve para que el cliente vea cuánto le sale según el volumen que pida.
 */
const tablaListaPrecios = (doc: jsPDF, c: Cotizacion, y: number, estado: { pagina: number }): number => {
  y = tituloSeccion(doc, 'Precios por cantidad', y);

  const xCant = 120;
  const xPrecio = PAGE_W - MARGIN - 3;

  (c.lista_precios ?? []).forEach((vol) => {
    y = asegurarEspacio(doc, y, 22, estado);

    // Encabezado del tamaño
    doc.setFillColor(...IRIS);
    doc.rect(MARGIN, y - 4.5, PAGE_W - MARGIN * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(vol.volumen_nombre.toUpperCase(), MARGIN + 3, y);
    doc.setFontSize(7.5);
    doc.text('CANTIDAD', xCant, y, { align: 'right' });
    doc.text('PRECIO POR UNIDAD', xPrecio, y, { align: 'right' });
    y += 8;

    vol.escalas.forEach((e) => {
      y = asegurarEspacio(doc, y, 9, estado);
      const rango = e.hasta ? `${e.desde} a ${e.hasta} unidades` : `${e.desde} unidades o más`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(rango, MARGIN + 3, y);
      doc.text(String(e.desde) + (e.hasta ? `-${e.hasta}` : '+'), xCant, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text(formatCOP(e.precio), xPrecio, y, { align: 'right' });

      doc.setDrawColor(...LINEA);
      doc.setLineWidth(0.2);
      doc.line(MARGIN, y + 3, PAGE_W - MARGIN, y + 3);
      y += 8;
    });
    y += 5;
  });

  // Aclaración: sin esto el cliente puede creer que el precio es por combo
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text('Precios por unidad. Puedes combinar las fragancias que quieras de nuestro catálogo.', MARGIN, y);
  return y + 8;
};

const resumen = (doc: jsPDF, c: Cotizacion, y: number): number => {
  const xEtiqueta = PAGE_W - MARGIN - 62;
  const xValor = PAGE_W - MARGIN - 3;
  const unidades = c.items.reduce((s, i) => s + i.cantidad, 0);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...LINEA);
  doc.roundedRect(PAGE_W - MARGIN - 78, y - 5, 78, c.descuento_pct > 0 ? 30 : 23, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Subtotal (${unidades} u)`, xEtiqueta, y);
  doc.setTextColor(...INK);
  doc.text(formatCOP(c.subtotal), xValor, y, { align: 'right' });
  y += 6;

  if (c.descuento_pct > 0) {
    doc.setTextColor(...MUTED);
    doc.text(`Descuento (${c.descuento_pct}%)`, xEtiqueta, y);
    doc.setTextColor(...IRIS);
    // Guion normal: el "menos" tipográfico (U+2212) no existe en Helvetica y
    // jsPDF lo renderiza descuadrando el texto.
    doc.text(`- ${formatCOP(c.subtotal - c.total)}`, xValor, y, { align: 'right' });
    y += 6;
  }

  doc.setDrawColor(...LINEA);
  doc.line(xEtiqueta, y - 2.5, xValor, y - 2.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...IRIS);
  doc.text('TOTAL', xEtiqueta, y + 3.5);
  doc.text(formatCOP(c.total), xValor, y + 3.5, { align: 'right' });

  return y + 14;
};

/**
 * "Tu pedido incluye": resume los obsequios/accesorios de toda la cotización.
 * Refuerza el valor de lo que se entrega (además del detalle por producto).
 */
const incluye = (doc: jsPDF, c: Cotizacion, y: number, estado: { pagina: number }): number => {
  const nombres = new Set<string>();
  c.items.forEach((i) => i.accesorios_seleccionados.forEach((a) => nombres.add(a.nombre)));
  (c.extras_pedido ?? []).forEach((a) => nombres.add(a.nombre));
  if (nombres.size === 0) return y;

  y = asegurarEspacio(doc, y, 22, estado);
  doc.setFillColor(...MARFIL);
  doc.setDrawColor(...IRIS);
  doc.setLineWidth(0.4);
  const alto = 9 + Math.ceil(nombres.size / 2) * 5;
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, alto, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...IRIS);
  doc.text('TU PEDIDO INCLUYE', MARGIN + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  const lista = [...nombres];
  const mitad = Math.ceil(lista.length / 2);
  lista.forEach((n, i) => {
    const col = i < mitad ? 0 : 1;
    const fila = i < mitad ? i : i - mitad;
    const x = MARGIN + 6 + col * ((PAGE_W - MARGIN * 2) / 2);
    doc.text(`• ${n}`, x, y + 11.5 + fila * 5);
  });

  return y + alto + 6;
};

/** Lista a dos columnas con viñetas (beneficios). */
const beneficios = (doc: jsPDF, items: string[], y: number, estado: { pagina: number }): number => {
  if (!items.length) return y;
  y = asegurarEspacio(doc, y, 30, estado);
  y = tituloSeccion(doc, '¿Por qué elegir Celestial Parfums?', y);

  const anchoCol = (PAGE_W - MARGIN * 2 - 8) / 2;
  const yInicio = y;
  // Se reparten por mitades para que ambas columnas queden parejas
  const corte = Math.ceil(items.length / 2);
  const columnas = [items.slice(0, corte), items.slice(corte)];
  let yMax = y;

  columnas.forEach((grupo, col) => {
    const x = MARGIN + col * (anchoCol + 8);
    let yCol = yInicio;
    grupo.forEach((texto) => {
      const lineas = doc.splitTextToSize(texto, anchoCol - 5) as string[];
      doc.setFillColor(...IRIS);
      doc.circle(x + 1.4, yCol - 1.2, 0.9, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(lineas, x + 4.5, yCol);
      yCol += lineas.length * 4 + 2.4;
    });
    yMax = Math.max(yMax, yCol);
  });

  return yMax + 4;
};

const condiciones = (doc: jsPDF, c: Cotizacion, y: number, estado: { pagina: number }): number => {
  const cc = c.condiciones_comerciales ?? ({} as Cotizacion['condiciones_comerciales']);
  const filas: [string, string][] = [
    ['Pedido mínimo', cc.pedido_minimo],
    ['Preparación', cc.tiempo_preparacion],
    ['Despacho', cc.tiempo_despacho],
    ['Forma de pago', cc.forma_pago],
    ['Condiciones de pago', cc.condiciones_pago],
    ['Costos de envío', cc.costos_envio],
    ['Garantías', cc.garantias],
    ['Cambios', cc.politica_cambios],
  ];
  const conDato = filas.filter(([, v]) => v && v.trim());
  if (!conDato.length && !c.observaciones) return y;

  y = asegurarEspacio(doc, y, 40, estado);
  y = tituloSeccion(doc, 'Condiciones comerciales', y);

  conDato.forEach(([etiqueta, valor]) => {
    y = asegurarEspacio(doc, y, 10, estado);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(`${etiqueta}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const lineas = doc.splitTextToSize(valor, PAGE_W - MARGIN * 2 - 42) as string[];
    doc.text(lineas, MARGIN + 40, y);
    y += Math.max(lineas.length * 4, 4) + 1.6;
  });

  if (c.observaciones?.trim()) {
    y = asegurarEspacio(doc, y, 16, estado) + 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text('Observaciones:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    const lineas = doc.splitTextToSize(c.observaciones, PAGE_W - MARGIN * 2) as string[];
    doc.text(lineas, MARGIN, y + 4.5);
    y += lineas.length * 4 + 8;
  }

  return y + 3;
};

const contacto = (doc: jsPDF, y: number, estado: { pagina: number }): number => {
  y = asegurarEspacio(doc, y, 24, estado);
  doc.setFillColor(...MARFIL);
  doc.setDrawColor(...IRIS);
  doc.setLineWidth(0.4);
  doc.roundedRect(MARGIN, y, PAGE_W - MARGIN * 2, 17, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...IRIS);
  doc.text('¿Listo para tu pedido?', MARGIN + 5, y + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(`Escríbenos por WhatsApp: +${WHATSAPP_NUMBER}`, MARGIN + 5, y + 12);
  return y + 22;
};

const avisosLegales = (doc: jsPDF, avisos: string[], vigencia: number, y: number, estado: { pagina: number }) => {
  if (!avisos.length) return;
  y = asegurarEspacio(doc, y, 34, estado);
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.2);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text('CONDICIONES GENERALES', MARGIN, y);
  y += 3.6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  avisos.forEach((aviso) => {
    // {{vigencia}} se reemplaza con los días reales de esta cotización
    const texto = aviso.replace(/\{\{\s*vigencia\s*\}\}/gi, String(vigencia));
    const lineas = doc.splitTextToSize(`• ${texto}`, PAGE_W - MARGIN * 2) as string[];
    y = asegurarEspacio(doc, y, lineas.length * 2.8 + 2, estado);
    doc.text(lineas, MARGIN, y);
    y += lineas.length * 2.8 + 0.8;
  });
};

/** Genera el PDF y devuelve el documento (para descargar o compartir). */
export const construirCotizacionPdf = (c: Cotizacion, config: CotizacionConfig): jsPDF => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const estado = { pagina: 1 };

  let y = encabezado(doc, c);
  y = datosCliente(doc, c, y);
  // Una lista de precios no lleva total: el cliente todavía no ha pedido nada
  if (c.tipo === 'general') {
    y = tablaListaPrecios(doc, c, y, estado);
  } else {
    y = tablaProductos(doc, c, y, estado);
    y = resumen(doc, c, y);
    y = incluye(doc, c, y, estado);
  }
  y = beneficios(doc, config.beneficios_items ?? [], y, estado);
  y = condiciones(doc, c, y, estado);
  y = contacto(doc, y, estado);
  avisosLegales(doc, config.avisos_legales ?? [], c.vigencia_dias, y, estado);

  piePagina(doc, estado.pagina);
  return doc;
};

export const nombreArchivoCotizacion = (c: Cotizacion) =>
  `${c.numero}-${(c.cliente_empresa || c.cliente_nombre).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')}.pdf`;

export const descargarCotizacionPdf = (c: Cotizacion, config: CotizacionConfig) => {
  construirCotizacionPdf(c, config).save(nombreArchivoCotizacion(c));
};

/** Mensaje corto para WhatsApp (el PDF se adjunta aparte, ya descargado). */
export const mensajeWhatsappCotizacion = (c: Cotizacion) => {
  let msg = `Hola ${c.cliente_nombre}! Te comparto la cotización ${c.numero} de ${MARCA}.\n\n`;

  if (c.tipo === 'general') {
    // Lista de precios: no hay total, se resumen los rangos por tamaño
    (c.lista_precios ?? []).forEach((v) => {
      msg += `*${v.volumen_nombre}*\n`;
      v.escalas.forEach((e) => {
        msg += `  ${e.desde}${e.hasta ? ` a ${e.hasta}` : ' o más'} u: ${formatCOP(e.precio)} c/u\n`;
      });
    });
    msg += '\nPuedes combinar las fragancias que quieras del catálogo.';
  } else {
    const unidades = c.items.reduce((s, i) => s + i.cantidad, 0);
    c.items.forEach((i, idx) => {
      msg += `${idx + 1}. ${i.perfume_nombre} (${i.volumen_nombre}) x${i.cantidad} — ${formatCOP(i.subtotal)}\n`;
    });
    msg += `\nTotal (${unidades} unidades): ${formatCOP(c.total)}`;
  }

  msg += `\nVálida hasta: ${fmtFecha(c.fecha_vigencia)}`;
  msg += '\n\nTe adjunto el PDF con el detalle completo.';
  return msg;
};
