import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { checkForUpdate } from '../utils/updateChecker';

export type UpdateStatus = 'idle' | 'checking' | 'found' | 'latest' | 'error';

interface UpdateState {
  hasUpdate: boolean;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  publishedAt: string;
  checking: boolean;
  checkStatus: UpdateStatus;

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
      checkStatus: 'idle' as UpdateStatus,

      checkForUpdate: async () => {
        const { checking } = get();

        if (checking) {
          return;
        }

        set({ checking: true, checkStatus: 'checking', hasUpdate: false });

        try {
          const info = await checkForUpdate();

          if (info) {
            set({
              hasUpdate: true,
              checkStatus: 'found',
              latestVersion: info.latestVersion,
              releaseNotes: info.releaseNotes,
              downloadUrl: info.downloadUrl,
              publishedAt: info.publishedAt,
              checking: false,
            });
          } else {
            set({
              hasUpdate: false,
              checkStatus: 'latest',
              checking: false,
            });
          }
        } catch (error) {
          console.error('Update check failed:', error);
          set({ checking: false, hasUpdate: false, checkStatus: 'error' });
        }
      },

      clearUpdate: () => {
        set({ hasUpdate: false, checkStatus: 'idle' });
      },
    }),
    {
      name: 'update-storage',
      partialize: (state) => ({
        latestVersion: state.latestVersion,
        releaseNotes: state.releaseNotes,
        downloadUrl: state.downloadUrl,
        publishedAt: state.publishedAt,
      }),
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useUpdateStore = useUpdateStore;
}
