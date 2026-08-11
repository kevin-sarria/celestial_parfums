import { prisma } from '../config/prisma';
import { calcularReposicion } from './reposicion.repository';
import { proponerEmparejamientos } from './emparejarEsencias.repository';
import { diasSinCopia, ultimaCopia, DIAS_AVISO_RESPALDO } from '../utils/estadoRespaldo';

/**
 * Centro de notificaciones del dashboard.
 *
 * Nació de un reclamo del dueño: la lista de material bajo mínimo se pintaba
 * ENTERA encima de Inventario y con los mínimos ya configurados eran **55
 * renglones** ocupando la pantalla. Se había diseñado cuando solo 1 de 226
 * materiales tenía mínimo puesto, así que mostraba una línea y se veía bien:
 * el defecto se destapó al llegar los datos de verdad.
 *
 * De ahí las dos reglas de este módulo:
 *
 * 1. **Cada aviso es UNA línea que empieza por el número.** Nunca la lista de
 *    lo que hay dentro — para eso está la pantalla a la que lleva.
 * 2. **Nada se guarda: se recalcula.** Mismo criterio que los sellos de
 *    fidelidad, el cupo y los promedios por gama. Una notificación guardada
 *    seguiría avisando de algo que el dueño ya resolvió.
 *
 * Y una tercera que es la que evita el peor error: **el número sale de la
 * MISMA función que usa la pantalla**, no de una consulta parecida escrita
 * aquí. Si la campana dijera 55 y el pedido sugerido 53, no se podría confiar
 * en ninguno de los dos.
 */

export type TonoNotificacion = 'urgente' | 'aviso' | 'info';

export interface Notificacion {
  /** Clave estable, para que el frontend pueda darle su icono sin adivinar. */
  id: string;
  /** UNA línea. Empieza por el número y dice qué pasa, no qué hacer. */
  texto: string;
  /** Pestaña del dashboard donde se resuelve. */
  tab: string;
  tono: TonoNotificacion;
}

/**
 * Plural escrito completo, no derivado.
 *
 * Misma decisión que en Clasificaciones: derivar el género o el plural a punta
 * de sufijos escribe mal las excepciones ("1 materiales", "1 reseñas"), y en
 * una barra que el dueño mira 50 veces al día eso se nota.
 */
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const ORDEN: Record<TonoNotificacion, number> = { urgente: 0, aviso: 1, info: 2 };

export const calcularNotificaciones = async (): Promise<Notificacion[]> => {
  const [
    reposicion, esenciasSinPerfume, perfumesSinEsencia,
    resenas, devoluciones, creditos, avisosStock, enNegativo,
  ] = await Promise.all([
    // Se reutiliza el cálculo de la pantalla para que los dos números coincidan
    calcularReposicion(),
    proponerEmparejamientos(),
    prisma.perfume.count({ where: { tipo_producto: 'fabricado', insumo_esencia_id: null } }),
    prisma.resena.count({ where: { estado: 'pendiente' } }),
    prisma.devolucion.count({ where: { estado: 'pendiente' } }),
    prisma.credito.findMany({
      where: { fecha_limite: { not: null } },
      select: { deuda_inicial: true, fecha_limite: true, abonos: { select: { monto: true } } },
    }),
    prisma.avisoStock.count({ where: { notificado: false } }),
    prisma.insumoCosto.count({ where: { activo: true, stock: { lt: 0 } } }),
  ]);

  /**
   * Vencido = sigue con saldo pasada la fecha pactada. Se calcula con el MISMO
   * criterio que `mapCredito` (saldo = deuda − abonos, comparado contra la
   * fecha límite) para que la campana y la pestaña de Créditos no se
   * contradigan.
   */
  const vencidos = creditos.filter((c) => {
    const abonado = c.abonos.reduce((s, a) => s + Number(a.monto), 0);
    const saldo = Math.max(0, Number(c.deuda_inicial) - abonado);
    return saldo > 0 && c.fecha_limite != null && Date.now() > new Date(c.fecha_limite).getTime();
  }).length;

  const porPedir = reposicion.esencias.length + reposicion.implementos.length;

  const lista: Notificacion[] = [];
  const sumar = (n: number, id: string, tab: string, tono: TonoNotificacion, uno: string, varios: string) => {
    if (n > 0) lista.push({ id, tab, tono, texto: plural(n, uno, varios) });
  };

  // Primero lo que cuesta plata mientras nadie lo mira
  sumar(vencidos, 'creditos_vencidos', 'creditos', 'urgente',
    'crédito venció sin terminar de pagarse', 'créditos vencieron sin terminar de pagarse');
  sumar(enNegativo, 'stock_negativo', 'inventario', 'urgente',
    'material quedó en negativo: hay que contarlo', 'materiales quedaron en negativo: hay que contarlos');
  sumar(perfumesSinEsencia, 'perfumes_sin_esencia', 'inventario', 'urgente',
    'perfume no descuenta material al venderse', 'perfumes no descuentan material al venderse');

  // Después lo que hay que atender pronto pero no sangra hoy
  sumar(devoluciones, 'devoluciones', 'devoluciones', 'aviso',
    'reclamo de garantía sin resolver', 'reclamos de garantía sin resolver');
  sumar(porPedir, 'reposicion', 'reposicion', 'aviso',
    'material llegó a su mínimo', 'materiales llegaron a su mínimo');
  sumar(esenciasSinPerfume.length, 'esencias_sin_perfume', 'inventario', 'aviso',
    'esencia sin perfume enlazado', 'esencias sin perfume enlazado');

  /**
   * El respaldo de la base.
   *
   * Vive aquí desde que el botón se movió al menú lateral (2026-08-11): antes
   * el recordatorio era un punto rojo sobre el botón del header, y esconder el
   * botón habría escondido también el aviso. La acción puede estar a dos clics
   * —es mantenimiento semanal—, pero **el recordatorio tiene que seguir a la
   * vista**: perder la base es lo único de esta lista que no se puede deshacer.
   *
   * `tab` va vacío a propósito: el respaldo no es una pestaña, se abre desde el
   * menú. El frontend muestra la línea sin enlace.
   */
  const dias = diasSinCopia();
  if (ultimaCopia() == null) {
    lista.push({
      id: 'respaldo', tab: '', tono: 'urgente',
      texto: 'Nunca has hecho una copia de la base de datos',
    });
  } else if (dias != null && dias >= DIAS_AVISO_RESPALDO) {
    lista.push({
      id: 'respaldo', tab: '', tono: 'aviso',
      texto: `Llevas ${dias} días sin hacer copia de la base`,
    });
  }

  // Y al final lo que es trabajo de rutina
  sumar(resenas, 'resenas', 'resenas', 'info',
    'reseña espera tu aprobación', 'reseñas esperan tu aprobación');
  sumar(avisosStock, 'avisos_stock', 'avisos', 'info',
    'cliente espera que vuelva un perfume', 'clientes esperan que vuelva un perfume');

  return lista.sort((a, b) => ORDEN[a.tono] - ORDEN[b.tono]);
};
