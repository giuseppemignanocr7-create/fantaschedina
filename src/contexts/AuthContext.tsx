import { createContext, useContext, ReactNode } from 'react';
import { useFirebaseAuth, type UseFirebaseAuth } from '@/hooks/useFirebaseAuth';

const AuthContext = createContext<UseFirebaseAuth | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): UseFirebaseAuth {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return ctx;
}
