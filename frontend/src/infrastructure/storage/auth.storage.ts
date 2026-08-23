import { authUserSchema, type AuthUser } from '../../domain/entities/auth.schema';

const USER_KEY = 'user';

export const authStorage = {
  getToken(): string | null {
    return null;
  },

  getUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = authUserSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  },

  save(_token: string, user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear(): void {
    localStorage.removeItem(USER_KEY);
  },
  clearAll(): void {
    localStorage.clear();
  },
};
