import { create } from 'zustand';
import type { ComboWithItems } from '@/types/database';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

interface CombosState {
  combos: ComboWithItems[];
  loadedAt: number | null;

  setCombos: (combos: ComboWithItems[]) => void;
  invalidate: () => void;
  isStale: () => boolean;
}

export const useCombosStore = create<CombosState>((set, get) => ({
  combos: [],
  loadedAt: null,

  setCombos: (combos) => set({ combos, loadedAt: Date.now() }),

  invalidate: () => set({ combos: [], loadedAt: null }),

  isStale: () => {
    const { loadedAt } = get();
    if (!loadedAt) return true;
    return Date.now() - loadedAt > CACHE_TTL;
  },
}));
