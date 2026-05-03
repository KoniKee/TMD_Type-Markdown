import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: Theme;
  imageDirectory: string;
  autoSave: boolean;
  autoSaveDelay: number;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setImageDirectory: (dir: string) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveDelay: (delay: number) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      imageDirectory: 'img',
      autoSave: true,
      autoSaveDelay: 1000,

      setTheme: (theme: Theme) => set({ theme }),
      toggleTheme: () => {
        const { theme, getEffectiveTheme } = get();
        const currentEffective = getEffectiveTheme();
        // 如果当前是暗色，切换到浅色；否则切换到暗色
        set({ theme: currentEffective === 'dark' ? 'light' : 'dark' });
      },
      setImageDirectory: (dir: string) => set({ imageDirectory: dir }),
      setAutoSave: (enabled: boolean) => set({ autoSave: enabled }),
      setAutoSaveDelay: (delay: number) => set({ autoSaveDelay: delay }),

      getEffectiveTheme: () => {
        const { theme } = get();
        if (theme === 'system') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
        }
        return theme;
      },
    }),
    {
      name: 'md-editor-settings',
    }
  )
);
