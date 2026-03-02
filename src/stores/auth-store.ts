import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Employee, EmployeeRole } from '@/types/database';

interface AuthState {
  employee: Omit<Employee, 'pin_hash'> | null;
  isAuthenticated: boolean;
  login: (employee: Omit<Employee, 'pin_hash'>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      employee: null,
      isAuthenticated: false,

      login: (employee) => {
        set({ employee, isAuthenticated: true });
      },

      logout: () => {
        set({ employee: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

// Helpers
export const isOwner = (role: EmployeeRole | undefined): boolean =>
  role === 'owner' || role === 'superadmin';

export const isSuperAdmin = (role: EmployeeRole | undefined): boolean =>
  role === 'superadmin';
