import { useEffect } from 'react';
import { useSplitStore, useEditorStore } from '../stores';

export const useSplitShortcuts = () => {
  const activeTabPath = useEditorStore((state) => state.activeTabPath);
  const splitPane = useSplitStore((state) => state.splitPane);
  const closePane = useSplitStore((state) => state.closePane);
  const focusNextPane = useSplitStore((state) => state.focusNextPane);
  const getCurrentState = useSplitStore((state) => state.getCurrentState);
  const canSplit = useSplitStore((state) => state.canSplit);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeTabPath) return;

      if (e.altKey && e.shiftKey) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          e.stopPropagation();
          
          if (canSplit(activeTabPath)) {
            const splitState = getCurrentState(activeTabPath);
            if (splitState) {
              splitPane(activeTabPath, splitState.activePaneId, 'vertical');
            }
          }
          return;
        }

        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          e.stopPropagation();
          
          if (canSplit(activeTabPath)) {
            const splitState = getCurrentState(activeTabPath);
            if (splitState) {
              splitPane(activeTabPath, splitState.activePaneId, 'horizontal');
            }
          }
          return;
        }

        if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          e.stopPropagation();
          
          const splitState = getCurrentState(activeTabPath);
          if (splitState) {
            closePane(activeTabPath, splitState.activePaneId);
          }
          return;
        }
      }

      if (e.altKey && !e.shiftKey && !e.ctrlKey) {
        let direction: 'up' | 'down' | 'left' | 'right' | null = null;
        
        if (e.key === 'ArrowLeft') {
          direction = 'left';
        } else if (e.key === 'ArrowRight') {
          direction = 'right';
        } else if (e.key === 'ArrowUp') {
          direction = 'up';
        } else if (e.key === 'ArrowDown') {
          direction = 'down';
        }

        if (direction) {
          e.preventDefault();
          e.stopPropagation();
          focusNextPane(activeTabPath, direction);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [activeTabPath, splitPane, closePane, focusNextPane, getCurrentState, canSplit]);
};
