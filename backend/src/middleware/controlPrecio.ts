import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { puede } from '../permisos/permisos';
import { cargarPedido, precioNormalDelPedido } from '../permisos/precioPedido';
import { empaqueParaPedido } from '../empaque/empaque.repository';
import { regaloDeEmpaque } from '../empaque/regaloDeEmpaque';
import { lineasDeVenta } from '../schemas/venta.schema';
import { pedirDescuento } from '../repositories/solicitud.repository';

/**
 * EL PRECIO LO PONE LA APP, NO EL PERSONAL (2026-10-04, decisión del dueño:
 * opción A). Va después de `validate` en registrar y corregir ventas y créditos.
 *
 * Quien tiene `descuentos.aplicar` (y el dueño) pasa sin más. A los demás se
 * les recalcula el precio normal en el servidor; hay descuento si cobran
 * menos, si regalan unidades o si traen un cupón. Regalar el EMPAQUE que le
 * toca al pedido (la bolsa, el perfumero, el kit del combo) no cuenta: es lo
 * que la venta lleva (2026-10-04, `empaque/`). Entonces:
 * - al REGISTRAR, no se registra: se crea una solicitud y la venta espera al
 *   dueño (responde 202 con `pendiente: true`);
 * - al CORREGIR, se rechaza: bajar el precio de algo ya registrado no se pide
 *   por aquí.
 */
const TOLERANCIA = 1; // un peso, por redondeos

export const controlPrecio = (que: 'venta' | 'credito', accion: 'registrar' | 'corregir') =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quien = req.jwtUser!;
      // El motivo es para la solicitud, no para la venta: no sigue hacia el servicio
      const { motivo_descuento: motivoCrudo, ...cuerpo } = req.body;
      req.body = cuerpo;
      if (await puede(quien.rol_id, 'descuentos.aplicar')) { next(); return; }

      const lineas = lineasDeVenta(cuerpo);
      const cargado = await cargarPedido(lineas);
      // Lo regalado que ES su empaque sale gratis sin pedir permiso: ni cuenta
      // como regalo ni suma al precio normal.
      const deEmpaque = regaloDeEmpaque(lineas, await empaqueParaPedido(lineas, cargado));
      const cobrables = lineas.map((l, i) => ({ ...l, cantidad: l.cantidad - deEmpaque[i], regalo: l.regalo - deEmpaque[i] }));
      const normal = await precioNormalDelPedido(cobrables, cargado);
      const pedido = Number(que === 'venta' ? cuerpo.valor_venta : cuerpo.deuda_inicial);
      const regala = cobrables.some((l) => l.regalo > 0);
      const cupon = !!cuerpo.codigo_descuento?.trim();
      if (!regala && !cupon && pedido >= normal - TOLERANCIA) { next(); return; }

      if (accion === 'corregir') {
        res.status(403).json({ error: `El precio normal es $${normal.toLocaleString('es-CO')}. Para cobrar menos, el dueño tiene que aprobar el descuento.` });
        return;
      }
      const motivo = typeof motivoCrudo === 'string' ? motivoCrudo.trim() : '';
      if (!motivo) {
        res.status(400).json({ error: 'Este pedido lleva un descuento: escribe por qué, y se lo enviamos al dueño para que lo apruebe.' });
        return;
      }
      const persona = que === 'venta'
        ? String(cuerpo.persona)
        : await prisma.user.findUnique({ where: { id: cuerpo.user_id }, select: { nombre: true, apellido: true } })
          .then((u) => (u ? `${u.nombre} ${u.apellido}`.trim() : `cliente #${cuerpo.user_id}`));
      const s = await pedirDescuento(que === 'venta' ? 'descuento_venta' : 'descuento_credito', quien.id, motivo,
        { cuerpo, precio_normal: normal, precio_pedido: pedido }, persona);
      res.status(202).json({
        pendiente: true,
        message: `Lleva un descuento: se envió al dueño. ${que === 'venta' ? 'La venta' : 'El crédito'} se registra cuando lo apruebe o lo rechace.`,
        data: { solicitud_id: s.id },
      });
    } catch (err) { next(err); }
  };
