import { authUserSchema, type AuthUser } from '../../domain/entities/auth.schema';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export const authStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = authUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },

  save(token: string, user: AuthUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};
