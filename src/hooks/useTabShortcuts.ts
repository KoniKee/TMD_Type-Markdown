import { useEffect } from 'react';
import { useEditorStore } from '../stores';

export const useTabShortcuts = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const closeDocument = useEditorStore((state) => state.closeDocument);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'w' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (activeDocPath) {
          closeDocument(activeDocPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDocPath, closeDocument]);
};
