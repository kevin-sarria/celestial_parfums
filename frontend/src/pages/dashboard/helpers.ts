import { BASE_URL } from '../../infrastructure/api/client';

export { formatPrice } from '@/lib/format';

export const API          = `${BASE_URL}/api/parfums`;
export const API_COMBOS   = `${BASE_URL}/api/combos`;
export const API_VENTAS   = `${BASE_URL}/api/ventas`;
export const API_CREDITOS = `${BASE_URL}/api/creditos`;
export const API_PAGOS    = `${BASE_URL}/api/pagos`;
export const API_CLIENTES = `${BASE_URL}/api/clientes`;
export const API_EMPRESAS = `${BASE_URL}/api/empresas`;
export const API_IMPORT   = `${BASE_URL}/api/import`;

export const DEFAULT_PAGE_SIZE = 10;

export const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO');
