import { create } from 'zustand';
import localforage from 'localforage';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

interface AuthData {
  token: string;
  user: User;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  initAuth: () => Promise<void>;
}

// Create dedicated auth storage instance
const authStorage = localforage.createInstance({
  name: 'musicmu',
  storeName: 'auth_data',
  description: 'Persistent authentication storage'
});

const AUTH_KEY = 'auth_session';

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  
  setAuth: async (token: string, user: User) => {
    // Save to IndexedDB for persistence
    await authStorage.setItem<AuthData>(AUTH_KEY, { token, user });
    set({ token, user, isAuthenticated: true });
  },
  
  logout: async () => {
    // Remove from IndexedDB
    await authStorage.removeItem(AUTH_KEY);
    set({ token: null, user: null, isAuthenticated: false });
  },
  
  updateUser: (user: User) => {
    set({ user });
    // Update user in storage
    authStorage.getItem<AuthData>(AUTH_KEY).then((data) => {
      if (data) {
        authStorage.setItem<AuthData>(AUTH_KEY, { ...data, user });
      }
    });
  },
  
  initAuth: async () => {
    try {
      // Load auth from IndexedDB on app startup
      const authData = await authStorage.getItem<AuthData>(AUTH_KEY);
      if (authData && authData.token && authData.user) {
        set({ 
          token: authData.token, 
          user: authData.user, 
          isAuthenticated: true
        });
      }
    } catch (error) {
      console.error('Failed to load auth from storage:', error);
    }
  }
}));

// API helper with authentication
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001';

export const api = {
  async fetch(endpoint: string, options: RequestInit = {}) {
    const token = useAuth.getState().token;
    const headers = new Headers(options.headers);
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      useAuth.getState().logout();
      throw new Error('Unauthorized');
    }

    return response;
  },

  async register(email: string, password: string, name?: string) {
    const response = await this.fetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    useAuth.getState().setAuth(data.token, data.user);
    return data;
  },

  async login(email: string, password: string) {
    const response = await this.fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    useAuth.getState().setAuth(data.token, data.user);
    return data;
  },

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.fetch('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Password change failed');
    }

    return data;
  }
};
