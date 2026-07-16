import { useEditorStore } from '../stores';
import { useShortcut } from './useShortcutManager';

export const useTabShortcuts = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const closeDocument = useEditorStore((state) => state.closeDocument);
  const tabs = useEditorStore((state) => state.tabs);
  const activeTabPath = useEditorStore((state) => state.activeTabPath);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);

  useShortcut('closeDoc', () => {
    if (activeDocPath) {
      closeDocument(activeDocPath);
    }
  }, [activeDocPath, closeDocument]);

  useShortcut('nextTab', () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(activeTabPath || '');
    const nextIndex = (currentIndex + 1) % tabs.length;
    const nextPath = tabs[nextIndex];
    setActiveTab(nextPath);
    useEditorStore.setState({ activeDocPath: nextPath });
  }, [tabs, activeTabPath, setActiveTab]);

  useShortcut('prevTab', () => {
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(activeTabPath || '');
    const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    const prevPath = tabs[prevIndex];
    setActiveTab(prevPath);
    useEditorStore.setState({ activeDocPath: prevPath });
  }, [tabs, activeTabPath, setActiveTab]);
};
