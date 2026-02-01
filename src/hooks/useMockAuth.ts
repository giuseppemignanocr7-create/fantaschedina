import { useState, useEffect } from 'react';

export interface MockUser {
  id: string;
  email: string;
  username: string;
  created_at: string;
}

export interface MockProfile {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  total_points: number;
  weekly_points: number;
  created_at: string;
  updated_at: string;
}

const USERS_KEY = 'fantaschedina_users';
const CURRENT_USER_KEY = 'fantaschedina_current_user';

function getStoredUsers(): MockUser[] {
  const stored = localStorage.getItem(USERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveUsers(users: MockUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser(): MockUser | null {
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  return stored ? JSON.parse(stored) : null;
}

function setCurrentUser(user: MockUser | null) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

export function useMockAuth() {
  const [user, setUser] = useState<MockUser | null>(null);
  const [profile, setProfile] = useState<MockProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
      setProfile({
        id: storedUser.id,
        username: storedUser.username,
        email: storedUser.email,
        avatar_url: null,
        total_points: Math.floor(Math.random() * 100),
        weekly_points: Math.floor(Math.random() * 20),
        created_at: storedUser.created_at,
        updated_at: new Date().toISOString()
      });
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const users = getStoredUsers();
    
    // Check if email already exists
    if (users.find(u => u.email === email)) {
      return { error: { message: 'Email già registrata' } };
    }
    
    // Check if username already exists
    if (users.find(u => u.username === username)) {
      return { error: { message: 'Username già in uso' } };
    }

    const newUser: MockUser = {
      id: crypto.randomUUID(),
      email,
      username,
      created_at: new Date().toISOString()
    };

    // Store password separately (in real app this would be hashed)
    const passwords = JSON.parse(localStorage.getItem('fantaschedina_passwords') || '{}');
    passwords[email] = password;
    localStorage.setItem('fantaschedina_passwords', JSON.stringify(passwords));

    users.push(newUser);
    saveUsers(users);
    setCurrentUser(newUser);
    setUser(newUser);
    
    const newProfile: MockProfile = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      avatar_url: null,
      total_points: 0,
      weekly_points: 0,
      created_at: newUser.created_at,
      updated_at: newUser.created_at
    };
    setProfile(newProfile);

    return { data: { user: newUser }, error: null };
  };

  const signIn = async (email: string, password: string) => {
    const users = getStoredUsers();
    const passwords = JSON.parse(localStorage.getItem('fantaschedina_passwords') || '{}');
    
    const foundUser = users.find(u => u.email === email);
    
    if (!foundUser) {
      return { error: { message: 'Email non trovata' } };
    }
    
    if (passwords[email] !== password) {
      return { error: { message: 'Password errata' } };
    }

    setCurrentUser(foundUser);
    setUser(foundUser);
    
    const userProfile: MockProfile = {
      id: foundUser.id,
      username: foundUser.username,
      email: foundUser.email,
      avatar_url: null,
      total_points: Math.floor(Math.random() * 100),
      weekly_points: Math.floor(Math.random() * 20),
      created_at: foundUser.created_at,
      updated_at: new Date().toISOString()
    };
    setProfile(userProfile);

    return { data: { user: foundUser }, error: null };
  };

  const signOut = async () => {
    setCurrentUser(null);
    setUser(null);
    setProfile(null);
    return { error: null };
  };

  const updateProfile = async (updates: Partial<MockProfile>) => {
    if (!profile) return { error: new Error('Not authenticated') };
    
    const updatedProfile = { ...profile, ...updates, updated_at: new Date().toISOString() };
    setProfile(updatedProfile);
    
    // Update in stored users too
    const users = getStoredUsers();
    const idx = users.findIndex(u => u.id === profile.id);
    if (idx !== -1 && updates.username) {
      users[idx].username = updates.username;
      saveUsers(users);
    }
    
    return { data: updatedProfile, error: null };
  };

  return {
    user,
    profile,
    session: user ? { user } : null,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    isAuthenticated: !!user
  };
}
