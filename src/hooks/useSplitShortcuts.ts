import { useSplitStore, useEditorStore } from '../stores';
import { useShortcut } from './useShortcutManager';

export const useSplitShortcuts = () => {
  const activeTabPath = useEditorStore((state) => state.activeTabPath);
  const splitPane = useSplitStore((state) => state.splitPane);
  const closePane = useSplitStore((state) => state.closePane);
  const focusNextPane = useSplitStore((state) => state.focusNextPane);
  const getCurrentState = useSplitStore((state) => state.getCurrentState);
  const canSplit = useSplitStore((state) => state.canSplit);

  useShortcut('splitVertical', () => {
    if (!activeTabPath) return;
    if (canSplit(activeTabPath)) {
      const splitState = getCurrentState(activeTabPath);
      if (splitState) {
        splitPane(activeTabPath, splitState.activePaneId, 'vertical');
      }
    }
  }, [activeTabPath, splitPane, getCurrentState, canSplit]);

  useShortcut('splitHorizontal', () => {
    if (!activeTabPath) return;
    if (canSplit(activeTabPath)) {
      const splitState = getCurrentState(activeTabPath);
      if (splitState) {
        splitPane(activeTabPath, splitState.activePaneId, 'horizontal');
      }
    }
  }, [activeTabPath, splitPane, getCurrentState, canSplit]);

  useShortcut('closePane', () => {
    if (!activeTabPath) return;
    const splitState = getCurrentState(activeTabPath);
    if (splitState && splitState.activePaneId) {
      const newActiveDocPath = closePane(activeTabPath, splitState.activePaneId);
      if (newActiveDocPath !== undefined && newActiveDocPath !== null) {
        useEditorStore.setState({
          activeDocPath: newActiveDocPath,
          activeTabPath: activeTabPath
        });
      }
    }
  }, [activeTabPath, closePane, getCurrentState]);

  useShortcut('switchPaneFocus', (e: KeyboardEvent) => {
    if (!activeTabPath) return;
    let direction: 'up' | 'down' | 'left' | 'right' | null = null;

    if (e.key === 'ArrowLeft') direction = 'left';
    else if (e.key === 'ArrowRight') direction = 'right';
    else if (e.key === 'ArrowUp') direction = 'up';
    else if (e.key === 'ArrowDown') direction = 'down';

    if (direction) {
      focusNextPane(activeTabPath, direction);
    }
  }, [activeTabPath, focusNextPane]);
};
