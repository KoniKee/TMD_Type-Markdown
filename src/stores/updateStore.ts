import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkForUpdate } from '../utils/updateChecker';

interface UpdateState {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  checking: boolean;

  checkForUpdate: () => Promise<void>;
  clearUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>()(
  persist(
    (set, get) => ({
      hasUpdate: false,
      latestVersion: '',
      releaseNotes: '',
      downloadUrl: '',
      publishedAt: '',
      checking: false,

      checkForUpdate: async () => {
        const { checking } = get();

        if (checking) {
          return;
        }

        set({ checking: true });

        try {
          const info = await checkForUpdate();
          set({
            hasUpdate: !!info,
            latestVersion: info?.latestVersion || '',
            releaseNotes: info?.releaseNotes || '',
            downloadUrl: info?.downloadUrl || '',
            publishedAt: info?.publishedAt || '',
            checking: false,
          });
        } catch (error) {
          console.error('Update check failed:', error);
          set({ checking: false });
        }
      },

      clearUpdate: () => {
        set({ hasUpdate: false });
      },
    }),
    {
      name: 'update-storage',
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useUpdateStore = useUpdateStore;
}
