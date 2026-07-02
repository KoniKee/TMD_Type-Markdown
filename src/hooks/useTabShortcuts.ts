import { useEditorStore } from '../stores';
import { useShortcut } from './useShortcutManager';

export const useTabShortcuts = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const closeDocument = useEditorStore((state) => state.closeDocument);

  useShortcut('closeDoc', () => {
    if (activeDocPath) {
      closeDocument(activeDocPath);
    }
  }, [activeDocPath, closeDocument]);
};
