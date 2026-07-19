import type { AuthUser } from "../domain/entities/auth.schema";

export interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAdmin: boolean;
  login(token: string, user: AuthUser): void;
  logout(): void;
}