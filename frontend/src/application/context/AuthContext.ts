import { createContext } from "react";
import type { AuthContextValue } from "../../interfaces/auth.interface";

export const AuthContext = createContext<AuthContextValue | null>(null);