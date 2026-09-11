// ============================================
// FANTA SCHEDINA - FIREBASE AUTH HOOK
// ============================================

import { useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  type User as FbUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import {
  ensureProfile,
  getProfile,
  updateProfile as dbUpdateProfile,
  type ProfileDoc,
} from '@/lib/db';
import { identifyUser, reportError } from '@/lib/monitoring';

interface AuthState {
  user: FbUser | null;
  profile: ProfileDoc | null;
  loading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface AuthApi {
  signUp: (email: string, password: string, username: string) => Promise<{ error: { message: string } | null }>;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>;
  /** Accesso o iscrizione con Google: lo stesso pulsante fa entrambe le cose. */
  signInWithGoogle: () => Promise<{ error: { message: string } | null }>;
  signOut: () => Promise<{ error: { message: string } | null }>;
  updateProfile: (
    updates: Pick<ProfileDoc, 'username'> | Pick<ProfileDoc, 'avatarUrl'>
  ) => Promise<{ error: { message: string } | null }>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ error: { message: string } | null }>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

export type UseFirebaseAuth = AuthState & AuthApi;

function mapFirebaseError(code?: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email o password non corretti';
    case 'auth/email-already-in-use':
      return 'Email già registrata';
    case 'auth/invalid-email':
      return 'Email non valida';
    case 'auth/weak-password':
      return 'Password troppo debole (minimo 6 caratteri)';
    case 'auth/too-many-requests':
      return 'Troppi tentativi, riprova più tardi';
    case 'auth/network-request-failed':
      return 'Errore di rete, riprova';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Accesso con Google annullato';
    case 'auth/account-exists-with-different-credential':
      return 'Questa email è già registrata con una password: entra con email e password';
    case 'auth/operation-not-allowed':
      return 'Accesso con Google non ancora attivo su questo progetto';
    default:
      return 'Errore di autenticazione';
  }
}

/**
 * Nome utente per chi arriva da Google: il displayName ("Mario Rossi") va
 * bene così com'è, ma le regole Firestore lo vogliono fra 2 e 30 caratteri.
 * Chi non ha un nome su Google prende la parte dell'email prima della @.
 */
export function usernameFromAccount(displayName: string | null, email: string | null): string {
  const base = (displayName?.trim() || email?.split('@')[0] || 'player').slice(0, 30);
  return base.length >= 2 ? base : 'player';
}

export function useFirebaseAuth(): UseFirebaseAuth {
  const [user, setUser] = useState<FbUser | null>(null);
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async fbUser => {
      setUser(fbUser);
      // Solo l'uid: è uno pseudonimo, l'email non serve per il debug.
      identifyUser(fbUser?.uid ?? null);
      if (fbUser) {
        try {
          const p = await getProfile(fbUser.uid);
          setProfile(
            p ??
              (await ensureProfile(
                fbUser.uid,
                fbUser.email ?? '',
                usernameFromAccount(fbUser.displayName, fbUser.email)
              ))
          );
        } catch (e) {
          reportError(e, { where: 'useFirebaseAuth:loadProfile' });
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getProfile(user.uid);
    setProfile(p);
  };

  const signUp: AuthApi['signUp'] = async (email, password, username) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await fbUpdateProfile(cred.user, { displayName: username });
      const p = await ensureProfile(cred.user.uid, email, username);
      setProfile(p);
      return { error: null };
    } catch (e) {
      const code = (e as { code?: string }).code;
      const message = mapFirebaseError(code);
      setError(message);
      return { error: { message } };
    }
  };

  const signIn: AuthApi['signIn'] = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (e) {
      const code = (e as { code?: string }).code;
      const message = mapFirebaseError(code);
      setError(message);
      return { error: { message } };
    }
  };

  // Il profilo Firestore lo crea onAuthStateChanged (ensureProfile), come per
  // l'email: qui basta l'accesso. Se il browser blocca il popup (capita nelle
  // PWA installate su iOS) si passa al redirect, e l'esito arriva allo stesso
  // listener al ritorno sulla pagina.
  const signInWithGoogle: AuthApi['signInWithGoogle'] = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
      return { error: null };
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
        return { error: null };
      }
      const message = mapFirebaseError(code);
      setError(message);
      return { error: { message } };
    }
  };

  const signOut: AuthApi['signOut'] = async () => {
    try {
      await fbSignOut(auth);
      return { error: null };
    } catch (e) {
      const message = (e as Error).message ?? 'Errore logout';
      return { error: { message } };
    }
  };

  const updateProfile: AuthApi['updateProfile'] = async updates => {
    if (!user) return { error: { message: 'Non autenticato' } };
    try {
      await dbUpdateProfile(user.uid, updates);
      await refreshProfile();
      return { error: null };
    } catch (e) {
      const message = (e as Error).message ?? 'Errore aggiornamento profilo';
      return { error: { message } };
    }
  };

  const changePassword: AuthApi['changePassword'] = async (currentPassword, newPassword) => {
    if (!user?.email) return { error: { message: 'Utente non autenticato' } };
    if (newPassword.length < 6) {
      return { error: { message: 'La nuova password deve avere almeno 6 caratteri' } };
    }
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      return { error: null };
    } catch (e) {
      const code = (e as { code?: string }).code;
      const message = mapFirebaseError(code);
      setError(message);
      return { error: { message } };
    }
  };

  const clearError = () => setError(null);

  return {
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    error,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword,
    refreshProfile,
    clearError,
  };
}
