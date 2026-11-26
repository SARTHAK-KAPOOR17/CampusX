// client/src/store/authStore.js
import { create } from 'zustand';
import { authApi, configureAuthHandlers } from '../services/api';

/**
 * Zustand Auth Store
 * Security invariant: accessToken is kept strictly in memory (never localStorage/sessionStorage).
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,

  setAuth: ({ user, accessToken }) =>
    set({
      user,
      accessToken,
      isAuthenticated: Boolean(user && accessToken),
      error: null,
    }),

  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    }),

  clearError: () => set({ error: null }),

  signup: async ({ name, email, password }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.signup({ name, email, password });
      const { user, accessToken } = res.data;
      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Signup failed',
      });
      throw err;
    }
  },

  login: async ({ email, password }) => {
    set({ isLoading: true, error: null });
    try {
      const res = await authApi.login({ email, password });
      const { user, accessToken } = res.data;
      set({
        user,
        accessToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
      return user;
    } catch (err) {
      set({
        isLoading: false,
        error: err.message || 'Login failed',
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Clear local auth state even if cookie was already absent/expired
    } finally {
      get().clearAuth();
    }
  },

  logoutAll: async () => {
    try {
      await authApi.logoutAll();
    } finally {
      get().clearAuth();
    }
  },

  silentRefresh: async () => {
    set({ isInitializing: true });
    try {
      const { user, accessToken } = await authApi.refresh();
      set({
        user,
        accessToken,
        isAuthenticated: true,
        isInitializing: false,
      });
      return true;
    } catch {
      set({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isInitializing: false,
      });
      return false;
    }
  },
}));

// Wire up Axios interceptors to read/update the in-memory Zustand store
configureAuthHandlers({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onRefreshSuccess: ({ user, accessToken }) => useAuthStore.getState().setAuth({ user, accessToken }),
  onRefreshFailure: () => useAuthStore.getState().clearAuth(),
});
