import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';
export type EditorWidth = 'full' | 'wide' | 'normal';
export type LineHeight = 1 | 1.15 | 1.5 | 2 | 2.5 | 3;

export const EMBED_MAX_DEPTH_MIN = 1;
export const EMBED_MAX_DEPTH_MAX = 5;
export const EMBED_MAX_DEPTH_DEFAULT = 3;

export const EMBED_MAX_COUNT_MIN = 1;
export const EMBED_MAX_COUNT_MAX = 30;
export const EMBED_MAX_COUNT_DEFAULT = 5;

interface SettingsState {
  theme: Theme;
  imageDirectory: string;
  autoSave: boolean;
  autoSaveDelay: number;
  embedMaxDepth: number;
  embedMaxCount: number;
  editorWidth: EditorWidth;
  lineHeight: LineHeight;

  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setImageDirectory: (dir: string) => void;
  setAutoSave: (enabled: boolean) => void;
  setAutoSaveDelay: (delay: number) => void;
  setEmbedMaxDepth: (depth: number) => void;
  setEmbedMaxCount: (count: number) => void;
  setEditorWidth: (width: EditorWidth) => void;
  setLineHeight: (height: LineHeight) => void;
  getEffectiveTheme: () => 'light' | 'dark';
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      imageDirectory: 'img',
      autoSave: true,
      autoSaveDelay: 1000,
      embedMaxDepth: EMBED_MAX_DEPTH_DEFAULT,
      embedMaxCount: EMBED_MAX_COUNT_DEFAULT,
      editorWidth: 'full' as EditorWidth,
      lineHeight: 1.5 as LineHeight,

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
      setEmbedMaxDepth: (depth: number) => {
        const clampedDepth = Math.min(EMBED_MAX_DEPTH_MAX, Math.max(EMBED_MAX_DEPTH_MIN, depth));
        set({ embedMaxDepth: clampedDepth });
      },
      setEmbedMaxCount: (count: number) => {
        const clampedCount = Math.min(EMBED_MAX_COUNT_MAX, Math.max(EMBED_MAX_COUNT_MIN, count));
        set({ embedMaxCount: clampedCount });
      },
      setEditorWidth: (width: EditorWidth) => set({ editorWidth: width }),
      setLineHeight: (height: LineHeight) => set({ lineHeight: height }),

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
