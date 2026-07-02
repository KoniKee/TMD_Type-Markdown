import { useEffect, useCallback } from 'react';
import { useShortcutStore } from '../stores/shortcutStore';
import { SHORTCUT_CATEGORIES } from '../data/shortcuts';

function parseKeyCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; key: string } {
  const parts = combo.split('+');
  const ctrl = parts.includes('Ctrl');
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');
  const key = parts.filter(p => !['Ctrl', 'Shift', 'Alt'].includes(p)).join('+') || '';
  return { ctrl, shift, alt, key };
}

function matchKeyEvent(e: KeyboardEvent, combo: string): boolean {
  const { ctrl, shift, alt, key } = parseKeyCombo(combo);

  if (key === '方向键') {
    return e.altKey === alt && e.shiftKey === shift && e.ctrlKey === ctrl &&
           ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key);
  }

  if (key === '+' || key === '=') {
    return e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt && (e.key === '+' || e.key === '=');
  }

  if (key === '-' || key === '_') {
    return e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt && (e.key === '-' || e.key === '_');
  }

  if (key === '/') {
    return e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt && e.key === '/';
  }

  return e.ctrlKey === ctrl && e.shiftKey === shift && e.altKey === alt && e.key.toLowerCase() === key.toLowerCase();
}

export function useShortcutKey(id: string): string {
  const customKey = useShortcutStore((s) => s.customShortcuts[id]);
  const item = SHORTCUT_CATEGORIES.flatMap(c => c.items).find(i => i.id === id);
  return customKey || item?.defaultKey || '';
}

export function useShortcut(
  id: string,
  handler: (e: KeyboardEvent) => void,
  deps: any[] = []
) {
  const keyCombo = useShortcutKey(id);
  const stableHandler = useCallback(handler, deps);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (matchKeyEvent(e, keyCombo)) {
        e.preventDefault();
        e.stopPropagation();
        stableHandler(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [keyCombo, stableHandler]);
}
