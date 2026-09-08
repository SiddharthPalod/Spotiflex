import { create } from 'zustand';
import axios from 'axios';
import { api } from '../services/movieService';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
}

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  isKids?: boolean;
  userId: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  profiles: Profile[];
  activeProfile: Profile | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; status?: number }>;
  loginWithGoogle: (credential?: string, accessToken?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name?: string) => Promise<{ success: boolean; devOtp?: string; error?: string }>;
  verifyOtp: (email: string, code: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  resendOtp: (email: string) => Promise<{ success: boolean; devOtp?: string; error?: string }>;
  
  // Family Profile Actions
  fetchProfiles: () => Promise<Profile[]>;
  createProfile: (name: string, avatar?: string, isKids?: boolean) => Promise<Profile | null>;
  updateProfileItem: (id: string, name?: string, avatar?: string, isKids?: boolean) => Promise<boolean>;
  deleteProfileItem: (id: string) => Promise<boolean>;
  setActiveProfile: (profile: Profile) => void;

  updateProfile: (name?: string, avatar?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

const TOKEN_KEY = 'spotiflix_auth_token';
const USER_KEY = 'spotiflix_auth_user';
const ACTIVE_PROFILE_KEY = 'spotiflix_active_profile';

// Setup axios defaults with credentials
api.defaults.withCredentials = true;

// Synchronously check URL query params for OAuth tokens on initial script load
if (typeof window !== 'undefined') {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || urlParams.get('auth_token');
  if (tokenFromUrl) {
    localStorage.setItem(TOKEN_KEY, tokenFromUrl);
    window.history.replaceState({}, '', window.location.pathname);
  }
}

const initialToken = localStorage.getItem(TOKEN_KEY);
const initialUser = localStorage.getItem(USER_KEY) ? JSON.parse(localStorage.getItem(USER_KEY)!) : null;
const initialActiveProfile = localStorage.getItem(ACTIVE_PROFILE_KEY)
  ? JSON.parse(localStorage.getItem(ACTIVE_PROFILE_KEY)!)
  : null;

if (initialToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
  axios.defaults.headers.common['Authorization'] = `Bearer ${initialToken}`;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  token: initialToken,
  profiles: [],
  activeProfile: initialActiveProfile,
  isAuthenticated: !!initialToken,
  isInitialized: !initialToken,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  setActiveProfile: (profile: Profile) => {
    localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profile));
    set({ activeProfile: profile });
  },

  fetchProfiles: async () => {
    try {
      const res = await api.get('/auth/profiles');
      const profiles: Profile[] = res.data.profiles || [];
      set({ profiles });

      // If no active profile or active profile doesn't belong to list, select first
      const current = get().activeProfile;
      const found = profiles.find((p) => p.id === current?.id);
      if (found) {
        set({ activeProfile: found });
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(found));
      } else if (profiles.length > 0) {
        set({ activeProfile: profiles[0] });
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(profiles[0]));
      }
      return profiles;
    } catch (err) {
      console.error('Failed to fetch profiles:', err);
      return [];
    }
  },

  createProfile: async (name: string, avatar?: string, isKids?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/profiles', { name, avatar, isKids });
      const newProfile: Profile = res.data.profile;
      const updatedProfiles = [...get().profiles, newProfile];
      set({ profiles: updatedProfiles, isLoading: false });
      return newProfile;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to create profile';
      set({ error: message, isLoading: false });
      return null;
    }
  },

  updateProfileItem: async (id: string, name?: string, avatar?: string, isKids?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/auth/profiles/${id}`, { name, avatar, isKids });
      const updated: Profile = res.data.profile;
      const updatedProfiles = get().profiles.map((p) => (p.id === id ? updated : p));
      
      const currentActive = get().activeProfile;
      const nextActive = currentActive?.id === id ? updated : currentActive;
      if (nextActive) {
        localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(nextActive));
      }

      set({
        profiles: updatedProfiles,
        activeProfile: nextActive,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to update profile';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  deleteProfileItem: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/auth/profiles/${id}`);
      const filtered = get().profiles.filter((p) => p.id !== id);
      
      let nextActive = get().activeProfile;
      if (nextActive?.id === id) {
        nextActive = filtered[0] || null;
        if (nextActive) {
          localStorage.setItem(ACTIVE_PROFILE_KEY, JSON.stringify(nextActive));
        } else {
          localStorage.removeItem(ACTIVE_PROFILE_KEY);
        }
      }

      set({
        profiles: filtered,
        activeProfile: nextActive,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to delete profile';
      set({ error: message, isLoading: false });
      return false;
    }
  },

  loginWithGoogle: async (credential?: string, accessToken?: string) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/google', { credential, accessToken });
      const { user, token } = res.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({
        user,
        token,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null,
      });

      await get().fetchProfiles();
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Google sign-in failed';
      set({ error: message, isLoading: false, isInitialized: true });
      return { success: false, error: message };
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/login', { email, password });
      const { user, token } = res.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({
        user,
        token,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null,
      });

      await get().fetchProfiles();
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Invalid login credentials';
      const status = err.response?.status;
      set({ error: message, isLoading: false, isInitialized: true });
      return { success: false, error: message, status };
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/signup', { email, password, name });
      set({ isLoading: false, error: null });
      return { success: true, devOtp: res.data.devOtp };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to initiate signup';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  verifyOtp: async (email, code, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/auth/verify-otp', { email, code, password, name });
      const { user, token } = res.data;

      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));

      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      set({
        user,
        token,
        isAuthenticated: true,
        isInitialized: true,
        isLoading: false,
        error: null,
      });

      await get().fetchProfiles();
      return { success: true };
    } catch (err: any) {
      const message = err.response?.data?.error || 'OTP verification failed';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  resendOtp: async (email) => {
    try {
      const res = await api.post('/auth/resend-otp', { email });
      return { success: true, devOtp: res.data.devOtp };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to resend OTP';
      return { success: false, error: message };
    }
  },

  updateProfile: async (name, avatar) => {
    set({ isLoading: true });
    try {
      const res = await api.put('/auth/profile', { name, avatar });
      const updatedUser = res.data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));

      set({ user: updatedUser, isLoading: false });
      await get().fetchProfiles();
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.response?.data?.error || 'Failed to update profile' });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      delete api.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['Authorization'];
      set({
        user: null,
        token: null,
        profiles: [],
        activeProfile: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
        error: null,
      });
    }
  },

  checkAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ isAuthenticated: false, isInitialized: true, user: null, profiles: [], activeProfile: null });
      return;
    }

    try {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const res = await api.get('/auth/me');
      if (res.data.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user));
        set({ user: res.data.user, isAuthenticated: true, isInitialized: true, token });
        await get().fetchProfiles();
      } else {
        set({ isAuthenticated: false, isInitialized: true, user: null, profiles: [], activeProfile: null });
      }
    } catch (err) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(ACTIVE_PROFILE_KEY);
      delete api.defaults.headers.common['Authorization'];
      set({ user: null, token: null, profiles: [], activeProfile: null, isAuthenticated: false, isInitialized: true });
    }
  },
}));
