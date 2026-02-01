// ============================================
// FANTA SCHEDINA - AUTH SERVICE
// Sistema di autenticazione con localStorage
// ============================================

import type { Participant } from '@/types';

const USERS_STORAGE_KEY = 'fantaschedina-users';
const CURRENT_USER_KEY = 'fantaschedina-current-user';

export interface StoredUser {
  id: string;
  email: string;
  username: string;
  password: string; // In produzione usare hash!
  avatarUrl?: string;
  createdAt: string;
  isActive: boolean;
  totalPoints: number;
  weeklyPoints: number;
  rank: number;
  paidWeeks: number;
}

export interface AuthResult {
  success: boolean;
  user?: Participant;
  error?: string;
}

// Genera un ID univoco
function generateId(): string {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Ottieni tutti gli utenti registrati
export function getStoredUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(USERS_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Salva gli utenti
function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

// Converti StoredUser in Participant
function toParticipant(user: StoredUser): Participant {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    isActive: user.isActive,
    totalPoints: user.totalPoints,
    weeklyPoints: user.weeklyPoints,
    rank: user.rank,
    paidWeeks: user.paidWeeks,
  };
}

// Registrazione nuovo utente
export function registerUser(
  email: string,
  username: string,
  password: string
): AuthResult {
  const users = getStoredUsers();
  
  // Verifica email duplicata
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'Email già registrata' };
  }
  
  // Verifica username duplicato
  if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'Username già in uso' };
  }
  
  // Crea nuovo utente
  const newUser: StoredUser = {
    id: generateId(),
    email: email.toLowerCase(),
    username,
    password, // In produzione: usare bcrypt o simile
    createdAt: new Date().toISOString(),
    isActive: true,
    totalPoints: 0,
    weeklyPoints: 0,
    rank: users.length + 1,
    paidWeeks: 0,
  };
  
  users.push(newUser);
  saveUsers(users);
  
  // Salva utente corrente
  const participant = toParticipant(newUser);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(participant));
  
  return { success: true, user: participant };
}

// Login utente esistente
export function loginUser(email: string, password: string): AuthResult {
  const users = getStoredUsers();
  
  const user = users.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  
  if (!user) {
    return { success: false, error: 'Email o password non corretti' };
  }
  
  if (!user.isActive) {
    return { success: false, error: 'Account disattivato' };
  }
  
  const participant = toParticipant(user);
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(participant));
  
  return { success: true, user: participant };
}

// Logout
export function logoutUser(): void {
  localStorage.removeItem(CURRENT_USER_KEY);
}

// Ottieni utente corrente
export function getCurrentUser(): Participant | null {
  try {
    const data = localStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Verifica se l'utente è autenticato
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

// Aggiorna dati utente
export function updateUserData(
  userId: string,
  updates: Partial<Pick<StoredUser, 'totalPoints' | 'weeklyPoints' | 'rank' | 'paidWeeks'>>
): AuthResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return { success: false, error: 'Utente non trovato' };
  }
  
  users[userIndex] = { ...users[userIndex], ...updates };
  saveUsers(users);
  
  // Aggiorna anche l'utente corrente se è lo stesso
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    const updatedParticipant = toParticipant(users[userIndex]);
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedParticipant));
    return { success: true, user: updatedParticipant };
  }
  
  return { success: true, user: toParticipant(users[userIndex]) };
}

// Cambia password
export function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): AuthResult {
  const users = getStoredUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return { success: false, error: 'Utente non trovato' };
  }
  
  if (users[userIndex].password !== oldPassword) {
    return { success: false, error: 'Password attuale non corretta' };
  }
  
  users[userIndex].password = newPassword;
  saveUsers(users);
  
  return { success: true, user: toParticipant(users[userIndex]) };
}

// Ottieni tutti i partecipanti (per classifica)
export function getAllParticipants(): Participant[] {
  return getStoredUsers()
    .filter(u => u.isActive)
    .map(toParticipant)
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
