import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Shift } from '@/types/database';

interface CashRegister {
  initialCash: number;
  totalCash: number;
  totalTransfer: number;
  totalChange: number;
}

interface ShiftState {
  currentShift: Shift | null;
  cashRegister: CashRegister;
  shiftVerifiedAt: number | null;      // timestamp de la última verificación API
  inventoryCountVerified: boolean;     // si el conteo de inventario ya fue verificado

  setShift: (shift: Shift | null) => void;
  clearShift: () => void;
  setShiftVerifiedAt: (ts: number) => void;
  setInventoryCountVerified: (done: boolean) => void;

  // Caja
  openCashRegister: (initialCash: number) => void;
  addCashSale: (amount: number, change: number) => void;
  addTransferSale: (amount: number) => void;
  addMixedSale: (cashAmount: number, transferAmount: number, change: number) => void;
  resetCashRegister: () => void;
  getCashInRegister: () => number;
}

const initialCashRegister: CashRegister = {
  initialCash: 0,
  totalCash: 0,
  totalTransfer: 0,
  totalChange: 0,
};

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      currentShift: null,
      cashRegister: initialCashRegister,
      shiftVerifiedAt: null,
      inventoryCountVerified: false,

      setShift: (shift) => {
        set({ currentShift: shift });
      },

      clearShift: () => {
        set({ currentShift: null, shiftVerifiedAt: null, inventoryCountVerified: false });
      },

      setShiftVerifiedAt: (ts) => {
        set({ shiftVerifiedAt: ts });
      },

      setInventoryCountVerified: (done) => {
        set({ inventoryCountVerified: done });
      },

      openCashRegister: (initialCash) => {
        set({
          cashRegister: {
            ...initialCashRegister,
            initialCash,
            totalCash: initialCash,
          },
        });
      },

      addCashSale: (amount, change) => {
        const { cashRegister } = get();
        set({
          cashRegister: {
            ...cashRegister,
            totalCash: cashRegister.totalCash + amount - change,
            totalChange: cashRegister.totalChange + change,
          },
        });
      },

      addTransferSale: (amount) => {
        const { cashRegister } = get();
        set({
          cashRegister: {
            ...cashRegister,
            totalTransfer: cashRegister.totalTransfer + amount,
          },
        });
      },

      addMixedSale: (cashAmount, transferAmount, change) => {
        const { cashRegister } = get();
        set({
          cashRegister: {
            ...cashRegister,
            totalCash: cashRegister.totalCash + cashAmount - change,
            totalTransfer: cashRegister.totalTransfer + transferAmount,
            totalChange: cashRegister.totalChange + change,
          },
        });
      },

      resetCashRegister: () => {
        set({ cashRegister: initialCashRegister });
      },

      getCashInRegister: () => {
        const { cashRegister } = get();
        return cashRegister.totalCash;
      },
    }),
    {
      name: 'shift-storage',
    }
  )
);
