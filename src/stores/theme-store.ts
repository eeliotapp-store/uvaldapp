import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

function applyThemeClass(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',

      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },

      toggleTheme: () => {
        const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
        applyThemeClass(next);
        set({ theme: next });
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        // Al recuperar la preferencia guardada, sincroniza la clase .dark
        // (el script inline en layout.tsx ya la puso para evitar parpadeo;
        // esto solo la mantiene en sync si el estado difiere)
        if (state) applyThemeClass(state.theme);
      },
    }
  )
);
