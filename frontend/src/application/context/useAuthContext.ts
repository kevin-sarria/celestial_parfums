import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthContextValue } from "../../interfaces/auth.interface";

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
