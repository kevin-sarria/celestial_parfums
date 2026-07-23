import { prisma } from '../config/prisma';

/**
 * Motor del perfil crediticio de un cliente (SOLO visible para el admin).
 *
 * Reglas de comportamiento acordadas con el negocio:
 * - PAGO RÁPIDO: si en los primeros 14 días de un crédito el cliente abona
 *   $300.000 o más, el cupo sube 10% (una vez por crédito).
 * - PAGO LENTO: si con saldo pendiente pasan más de 30 días sin ningún abono,
 *   el cupo baja 10% (una vez por crédito).
 * - CUPÓN VENCIDO: un crédito que usó cupón y sigue con saldo pasada su fecha
 *   límite pactada castiga el DOBLE (-20%). El descuento + el plazo incumplido
 *   no pueden salir gratis. Reemplaza al pago lento en ese crédito (no se suman).
 * - VETO: un crédito con saldo pendiente y más de 60 días sin movimiento veta
 *   al cliente para créditos directos (hasta que vuelva a abonar).
 *
 * El factor se recalcula SIEMPRE desde el historial completo (no se guarda),
 * así nunca se desincroniza con los datos.
 */

const DIA = 86400000;
export const PAGO_RAPIDO_MONTO = 300000;
export const PAGO_RAPIDO_DIAS = 14;
export const PAGO_LENTO_DIAS = 30;
export const VETO_DIAS = 60;
const FACTOR_MIN = 0.5;
const FACTOR_MAX = 2;

export interface EventoCredito {
  tipo: 'pago_rapido' | 'pago_lento' | 'cupon_vencido' | 'veto';
  credito_id: number;
  detalle: string;
}

export const getPerfilCrediticio = async (userId: number) => {
  const cliente = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      creditos: {
        orderBy: { fecha: 'asc' },
        include: {
          abonos: { orderBy: { fecha: 'asc' } },
          // Un crédito "con cupón" es el que tiene un código canjeado en su venta
          venta: { select: { codigo: { select: { codigo: true } } } },
        },
      },
    },
  });
  if (!cliente) throw new Error('Persona no encontrada');

  const hoy = Date.now();
  const eventos: EventoCredito[] = [];
  let factor = 1;
  let vetado = false;
  let deudaTotal = 0;

  const creditos = cliente.creditos.map((c) => {
    const deudaInicial = Number(c.deuda_inicial);
    const abonado = c.abonos.reduce((s, a) => s + Number(a.monto), 0);
    const saldo = Math.max(0, deudaInicial - abonado);
    deudaTotal += saldo;

    // Pago rápido: abonos de los primeros 14 días del crédito
    const abonadoRapido = c.abonos
      .filter((a) => a.fecha.getTime() - c.fecha.getTime() <= PAGO_RAPIDO_DIAS * DIA)
      .reduce((s, a) => s + Number(a.monto), 0);
    if (abonadoRapido >= PAGO_RAPIDO_MONTO) {
      factor *= 1.1;
      eventos.push({
        tipo: 'pago_rapido',
        credito_id: c.id,
        detalle: `Abonó $${abonadoRapido.toLocaleString('es-CO')} en los primeros ${PAGO_RAPIDO_DIAS} días (+10% cupo)`,
      });
    }

    // Pago lento: la mayor brecha sin abonos mientras hubo saldo pendiente.
    // Movimientos = fecha del crédito + cada abono; si sigue debiendo, hoy cierra la brecha.
    const movimientos = [c.fecha.getTime(), ...c.abonos.map((a) => a.fecha.getTime())];
    let mayorBrechaDias = 0;
    for (let i = 1; i < movimientos.length; i++) {
      // solo cuenta si antes del movimiento i aún había saldo
      const abonadoHasta = c.abonos.slice(0, i - 1).reduce((s, a) => s + Number(a.monto), 0);
      if (deudaInicial - abonadoHasta <= 0) break;
      mayorBrechaDias = Math.max(mayorBrechaDias, (movimientos[i] - movimientos[i - 1]) / DIA);
    }
    const diasSinAbono = saldo > 0 ? (hoy - movimientos[movimientos.length - 1]) / DIA : 0;
    if (saldo > 0) mayorBrechaDias = Math.max(mayorBrechaDias, diasSinAbono);

    // Crédito con cupón + saldo pendiente pasada su fecha límite = castigo doble.
    const conCupon = !!c.venta?.codigo;
    const vencido = saldo > 0 && c.fecha_limite != null && hoy > c.fecha_limite.getTime();

    if (conCupon && vencido) {
      factor *= 0.8;
      eventos.push({
        tipo: 'cupon_vencido',
        credito_id: c.id,
        detalle: `Usó cupón y no saldó antes del ${c.fecha_limite!.toISOString().slice(0, 10)} (-20% cupo)`,
      });
    } else if (mayorBrechaDias > PAGO_LENTO_DIAS) {
      factor *= 0.9;
      eventos.push({
        tipo: 'pago_lento',
        credito_id: c.id,
        detalle: `Estuvo ${Math.floor(mayorBrechaDias)} días sin abonar con saldo pendiente (-10% cupo)`,
      });
    }

    // Veto: saldo pendiente hoy y más de 2 meses sin ningún movimiento
    if (saldo > 0 && diasSinAbono > VETO_DIAS) {
      vetado = true;
      eventos.push({
        tipo: 'veto',
        credito_id: c.id,
        detalle: `Lleva ${Math.floor(diasSinAbono)} días sin abonar (máximo ${VETO_DIAS}): vetado para crédito directo`,
      });
    }

    return {
      id: c.id,
      fecha: c.fecha,
      articulos: c.articulos,
      deuda_inicial: deudaInicial,
      abonado,
      saldo,
      dias_sin_abono: Math.floor(diasSinAbono),
      abonos: c.abonos.map((a) => ({ monto: Number(a.monto), fecha: a.fecha })),
    };
  });

  factor = Math.min(FACTOR_MAX, Math.max(FACTOR_MIN, factor));
  const cupoBase = Number(cliente.cupo_base);
  const cupo = Math.round((cupoBase * factor) / 1000) * 1000;

  return {
    user_id: cliente.id,
    nombre: `${cliente.nombre} ${cliente.apellido}`,
    cupo_base: cupoBase,
    factor: Number(factor.toFixed(3)),
    cupo,
    deuda_total: deudaTotal,
    cupo_disponible: Math.max(0, cupo - deudaTotal),
    vetado,
    tiene_credito_activo: creditos.some((c) => c.saldo > 0),
    eventos,
    creditos,
  };
};
