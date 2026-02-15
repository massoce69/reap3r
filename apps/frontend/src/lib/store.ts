// ─────────────────────────────────────────────────────────────
// MASSVISION Reap3r - Auth Store (Zustand)
// ─────────────────────────────────────────────────────────────

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile, Permission } from '@massvision/shared';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  setUser: (user: UserProfile) => void;
  clearUser: () => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (...permissions: Permission[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user: UserProfile) =>
        set({ user, isAuthenticated: true }),

      clearUser: () =>
        set({ user: null, isAuthenticated: false }),

      hasPermission: (permission: Permission) => {
        const { user } = get();
        return user?.permissions?.includes(permission) ?? false;
      },

      hasAnyPermission: (...permissions: Permission[]) => {
        const { user } = get();
        if (!user?.permissions) return false;
        return permissions.some((p) => user.permissions.includes(p));
      },
    }),
    {
      name: 'massvision-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
