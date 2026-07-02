import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SHORTCUT_CATEGORIES } from '../data/shortcuts';

interface ShortcutStoreState {
  customShortcuts: Record<string, string>;
  setCustomShortcut: (id: string, key: string) => void;
  resetShortcut: (id: string) => void;
  resetAll: () => void;
  getShortcutKey: (id: string) => string;
}

export const useShortcutStore = create<ShortcutStoreState>()(
  persist(
    (set, get) => ({
      customShortcuts: {},
      setCustomShortcut: (id: string, key: string) => {
        set((state) => ({ customShortcuts: { ...state.customShortcuts, [id]: key } }));
      },
      resetShortcut: (id: string) => {
        set((state) => {
          const newCustom = { ...state.customShortcuts };
          delete newCustom[id];
          return { customShortcuts: newCustom };
        });
      },
      resetAll: () => set({ customShortcuts: {} }),
      getShortcutKey: (id: string) => {
        const custom = get().customShortcuts[id];
        if (custom) return custom;
        const defaultKey = SHORTCUT_CATEGORIES.flatMap(c => c.items).find(item => item.id === id)?.defaultKey;
        return defaultKey || '';
      },
    }),
    {
      name: 'md-editor-shortcuts',
      version: 1,
    }
  )
);
