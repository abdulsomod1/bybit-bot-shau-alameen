// src/renderer/lib/auth-context.tsx
// STUB — single-user app, no real auth. The dashboard has no login screen.
// useAuth returns a static stub user. Owner token is handled via API header.
import { createContext, useContext, type ReactNode } from 'react';
import { BOT_OWNER_ID } from '../../shared/constants';

interface AuthUser { id: string; email?: string; displayName?: string; }
interface AuthContextValue { user: AuthUser; loading: boolean; signOut: () => Promise<void>; }

const GUEST_USER: AuthUser = { id: BOT_OWNER_ID };
const AuthContext = createContext<AuthContextValue>({ user: GUEST_USER, loading: false, signOut: async () => {} });

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: GUEST_USER, loading: false, signOut: async () => {} }}>{children}</AuthContext.Provider>;
}
