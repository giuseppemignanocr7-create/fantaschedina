import { createContext, useContext, ReactNode } from 'react';
import { useMockAuth, MockUser, MockProfile } from '@/hooks/useMockAuth';

interface AuthContextType {
  user: MockUser | null;
  profile: MockProfile | null;
  session: { user: MockUser } | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ data?: any; error: any }>;
  signIn: (email: string, password: string) => Promise<{ data?: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (updates: Partial<MockProfile>) => Promise<{ data?: any; error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useMockAuth();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
