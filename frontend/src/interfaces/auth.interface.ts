import type { AuthUser } from "../domain/entities/auth.schema";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  /** Entra al panel: el dueño o su personal. */
  esPersonal: boolean;
  /**
   * ¿Puede hacer esto? Basta con UNO de los permisos. Solo esconde: quien
   * decide es el servidor (`requirePermiso`).
   */
  puede(...permisos: string[]): boolean;
  login(token: string, user: AuthUser): void;
  logout(): void;
}