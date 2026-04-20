export interface LoginDTO {
  email: string;
  password: string;
}

export interface RegisterDTO {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol_id: number;
}

export interface UserRow {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  rol_id: number;
  activo: boolean;
  verification_token: string | null;
  token_expiry: Date | null;
}
