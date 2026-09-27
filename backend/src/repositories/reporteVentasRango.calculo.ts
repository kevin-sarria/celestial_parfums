/**
 * La aritmética del reporte de ventas por RANGO de fechas, sin base de datos.
 *
 * Vive aparte de las consultas para poder probarla con números a mano: es
 * plata, y "debería dar" no vale (CLAUDE.md). Las consultas solo juntan filas
 * y se las pasan a estas funciones.
 *
 * Las definiciones las fijó el dueño el 2026-09-27:
 *   - **Vendido** = solo lo que YA SE PAGÓ POR COMPLETO. Lo demás es **deuda**.
 *   - Donde no hay costo registrado, costo y ganancia dicen **"sin datos"**
 *     (null), nunca cero: un cero pintaría una ganancia del 100 % que no existe.
 *     El costo de lo vendido solo se registra desde agosto de 2026.
 */

export interface VentaFila {
  id: number;
  /** Fecha de calendario (medianoche UTC, como Prisma lee `@db.Date`). */
  dia: Date;
  persona: string;
  valor: number;
  pagada: boolean;
  /** 0 = el sistema no registró costo para esa venta. */
  costo: number;
  unidades: number;
  regalos: number;
  /** Solo si es un crédito: lo que ya abonó (para saber cuánto se debe aún). */
  abonado: number | null;
}

/** Algo que se fue sin venderse, con su valor al costo. */
export interface SalidaFila {
  fecha: Date;
  tipo: 'merma' | 'ajuste' | 'garantia' | 'muestra';
  valor: number;
}

export interface CompraFila { dia: Date; valor: number; envio: number }
export interface DevolucionFila { fecha: Date; monto: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Clave AAAA-MM en UTC: las columnas `@db.Date` se leen como medianoche UTC. */
export const claveMes = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

/** Los meses que toca el rango, en orden, aunque en alguno no haya pasado nada. */
export const mesesDelRango = (desde: Date, hasta: Date) => {
  const meses: string[] = [];
  const d = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), 1));
  while (d <= hasta) {
    meses.push(claveMes(d));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return meses;
};

/**
 * Las cifras de un grupo de ventas (el rango entero o un mes).
 *
 * La ganancia se mide SOLO sobre las ventas que tienen costo: mezclar las que
 * no lo tienen la inflaría. Cuántas quedaron por fuera se dice aparte
 * (`sin_costo`), para que el número no parezca más completo de lo que es.
 */
export const resumirVentas = (ventas: VentaFila[]) => {
  const pagadas = ventas.filter((v) => v.pagada);
  const deudas = ventas.filter((v) => !v.pagada);
  const conCosto = pagadas.filter((v) => v.costo > 0);
  const sinCosto = pagadas.filter((v) => v.costo <= 0);

  const suma = (xs: VentaFila[], f: (v: VentaFila) => number) => r2(xs.reduce((s, v) => s + f(v), 0));
  const vendidoConCosto = suma(conCosto, (v) => v.valor);
  const costo = suma(conCosto, (v) => v.costo);
  const hayCosto = conCosto.length > 0;
  const ganancia = hayCosto ? r2(vendidoConCosto - costo) : null;

  return {
    num_ventas: pagadas.length,
    unidades: pagadas.reduce((s, v) => s + v.unidades, 0),
    regalos: pagadas.reduce((s, v) => s + v.regalos, 0),
    vendido: suma(pagadas, (v) => v.valor),
    ticket_promedio: pagadas.length ? r2(suma(pagadas, (v) => v.valor) / pagadas.length) : 0,
    /** Lo que falta por cobrar: en un crédito, el valor menos lo ya abonado. */
    en_deuda: suma(deudas, (v) => Math.max(0, v.valor - (v.abonado ?? 0))),
    num_en_deuda: deudas.length,
    unidades_en_deuda: deudas.reduce((s, v) => s + v.unidades, 0),
    costo: hayCosto ? costo : null,
    ganancia,
    /** Sobre lo vendido CON costo, que es lo único con lo que se puede medir. */
    margen_pct: ganancia != null && vendidoConCosto > 0
      ? Math.round((ganancia / vendidoConCosto) * 1000) / 10
      : null,
    sin_costo: { num: sinCosto.length, valor: suma(sinCosto, (v) => v.valor) },
    /**
     * Qué parte de lo vendido tiene costo registrado. Con 1 de 20 ventas
     * costeadas (febrero de 2026) la ganancia existe, pero NO es la del mes:
     * la pantalla la marca como parcial en vez de dejar que se lea entera.
     */
    cobertura_pct: pagadas.length && suma(pagadas, (v) => v.valor) > 0
      ? Math.round((vendidoConCosto / suma(pagadas, (v) => v.valor)) * 100)
      : null,
  };
};

/**
 * Lo que se perdió, separado por causa. Las MUESTRAS no son pérdida (son
 * inversión en vender, decisión del 2026-08-10) y por eso van aparte y no
 * suman al total.
 */
export const resumirPerdidas = (
  salidas: SalidaFila[], devoluciones: DevolucionFila[], ventas: VentaFila[],
) => {
  const de = (tipo: SalidaFila['tipo']) => r2(salidas.filter((s) => s.tipo === tipo).reduce((t, s) => t + s.valor, 0));
  const bajoCosto = ventas
    .filter((v) => v.pagada && v.costo > v.valor)
    .map((v) => ({ id: v.id, dia: v.dia, persona: v.persona, valor: v.valor, costo: v.costo, perdida: r2(v.costo - v.valor) }));

  const mermas = de('merma');
  const ajustes = de('ajuste');
  const garantias = de('garantia');
  const devuelto = r2(devoluciones.reduce((t, d) => t + d.monto, 0));
  const ventasBajoCosto = r2(bajoCosto.reduce((t, v) => t + v.perdida, 0));

  return {
    mermas,
    /** Lo que faltó al contar la bodega: el desperdicio del día a día. */
    diferencias_conteo: ajustes,
    /** El costo de lo que se repuso por garantía. */
    garantias,
    dinero_devuelto: devuelto,
    ventas_bajo_costo: ventasBajoCosto,
    detalle_bajo_costo: bajoCosto,
    total: r2(mermas + ajustes + garantias + devuelto + ventasBajoCosto),
    muestras: de('muestra'),
  };
};

/** Compras a proveedores del periodo: lo que se INVIRTIÓ, envíos incluidos. */
export const resumirCompras = (compras: CompraFila[]) => ({
  num: compras.length,
  compras: r2(compras.reduce((t, c) => t + c.valor, 0)),
  envios: r2(compras.reduce((t, c) => t + c.envio, 0)),
  total: r2(compras.reduce((t, c) => t + c.valor + c.envio, 0)),
});

/** Parte cualquier lista por mes con la fecha que diga `fecha`. */
export const porMes = <T>(xs: T[], fecha: (x: T) => Date) => {
  const m = new Map<string, T[]>();
  xs.forEach((x) => {
    const k = claveMes(fecha(x));
    m.set(k, [...(m.get(k) ?? []), x]);
  });
  return (k: string) => m.get(k) ?? [];
};
