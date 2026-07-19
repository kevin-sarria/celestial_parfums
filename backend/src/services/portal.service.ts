import { getPerfilCrediticio } from './creditoPerfil.service';

/**
 * Portal del cliente final (usuario logueado): SOLO consulta de su crédito
 * (deuda y cuotas pagadas). Los créditos los otorga el administrador desde el
 * dashboard. NUNCA se expone cupo, factor, eventos ni veto (datos internos).
 */
export const getPortalCredito = async (userId: number) => {
  const perfil = await getPerfilCrediticio(userId);

  return {
    tiene_credito_activo: perfil.tiene_credito_activo,
    deuda_total: perfil.deuda_total,
    creditos: perfil.creditos.map((c) => ({
      id: c.id,
      fecha: c.fecha,
      articulos: c.articulos,
      deuda_inicial: c.deuda_inicial,
      abonado: c.abonado,
      saldo: c.saldo,
      // Cuotas que ya pagó (cada abono con monto y fecha)
      abonos: c.abonos,
    })),
  };
};
