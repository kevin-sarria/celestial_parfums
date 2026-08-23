export interface CreateEmpresaDTO {
  nombre: string;
  nit?: string;
  telefono?: string;
  correo?: string;
  direccion?: string;
  /// Cómo factura el IVA: incluido en el precio, sumado aparte, o no lo cobra.
  iva_modo?: 'incluido' | 'agregado' | 'sin_iva';
}
