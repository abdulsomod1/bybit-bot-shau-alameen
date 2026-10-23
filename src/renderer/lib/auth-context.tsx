// src/renderer/lib/auth-context.tsx
// STUB — single-user desktop app, no real auth.
// useAuth always returns a static guest user.
import { createContext, useContext, type ReactNode } from 'react';

interface AuthUser { id: string; email?: string; displayName?: string; }
interface AuthContextValue { user: AuthUser; loading: boolean; signOut: () => Promise<void>; }

const GUEST_USER: AuthUser = { id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' };
const AuthContext = createContext<AuthContextValue>({ user: GUEST_USER, loading: false, signOut: async () => {} });

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: GUEST_USER, loading: false, signOut: async () => {} }}>{children}</AuthContext.Provider>;
}
