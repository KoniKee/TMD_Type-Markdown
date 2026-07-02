import React, { useState, useEffect, useRef } from 'react';
import { X, Keyboard, RotateCcw } from 'lucide-react';
import { SHORTCUT_CATEGORIES, ShortcutItem } from '../../data/shortcuts';
import { useShortcutStore } from '../../stores/shortcutStore';

interface ShortcutsPanelProps {
  mode?: 'dialog' | 'embedded';
  onClose?: () => void;
}

export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({ mode = 'dialog', onClose }) => {
  const customShortcuts = useShortcutStore((s) => s.customShortcuts);
  const setCustomShortcut = useShortcutStore((s) => s.setCustomShortcut);
  const resetShortcut = useShortcutStore((s) => s.resetShortcut);
  const resetAll = useShortcutStore((s) => s.resetAll);
  const getShortcutKey = useShortcutStore((s) => s.getShortcutKey);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const editInputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleStartEdit = (item: ShortcutItem) => {
    if (!item.customizable) return;
    setEditingId(item.id);
    setConflictWarning(null);
  };

  const handleCaptureKey = (e: React.KeyboardEvent, item: ShortcutItem) => {
    if (e.key === 'Escape') {
      setEditingId(null);
      setConflictWarning(null);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    if (e.key === 'Enter') {
      setEditingId(null);
      setConflictWarning(null);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const modifiers: string[] = [];
    if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
    if (e.shiftKey) modifiers.push('Shift');
    if (e.altKey) modifiers.push('Alt');

    const ignoredKeys = ['Control', 'Shift', 'Alt', 'Meta'];
    if (ignoredKeys.includes(e.key)) return;

    let keyPart = e.key;
    if (keyPart === ' ') keyPart = 'Space';
    if (keyPart.startsWith('Arrow')) keyPart = '方向键';

    const newCombo = [...modifiers, keyPart].join('+');

    const allItems = SHORTCUT_CATEGORIES.flatMap(c => c.items);
    const conflict = allItems.find(i => {
      if (i.id === item.id) return false;
      const currentKey = getShortcutKey(i.id);
      return currentKey === newCombo;
    });

    if (conflict) {
      setConflictWarning(`与「${conflict.label}」冲突`);
      return;
    }

    setConflictWarning(null);
    setCustomShortcut(item.id, newCombo);
    setEditingId(null);

    e.preventDefault();
    e.stopPropagation();
  };

  const handleReset = (id: string) => {
    resetShortcut(id);
    if (editingId === id) {
      setEditingId(null);
      setConflictWarning(null);
    }
  };

  const handleResetAll = () => {
    resetAll();
    setEditingId(null);
    setConflictWarning(null);
  };

  const renderItem = (item: ShortcutItem) => {
    const currentKey = getShortcutKey(item.id);
    const isCustom = customShortcuts[item.id] !== undefined;
    const isEditing = editingId === item.id;

    return (
      <div key={item.id}>
        <div
          className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-colors ${
            isEditing ? 'bg-[var(--accent-500)]/10' : 'hover:bg-[var(--sidebar-hover)]'
          }`}
        >
          <span className="text-sm text-[var(--editor-text)]">{item.label}</span>

          {isEditing ? (
            <div className="flex items-center gap-1.5">
              <div
                ref={editInputRef}
                tabIndex={0}
                onKeyDown={(e) => handleCaptureKey(e, item)}
                onBlur={() => {
                  setEditingId(null);
                  setConflictWarning(null);
                }}
                className="px-2 py-0.5 text-xs font-mono bg-[var(--accent-500)]/20 text-[var(--accent-500)] rounded border border-[var(--accent-500)] animate-pulse min-w-[90px] text-center cursor-focus outline-none"
              >
                按下键位...
              </div>
              {isCustom && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleReset(item.id)}
                  className="p-1 text-[var(--editor-text-muted)] hover:text-[var(--error-500)] transition-colors"
                  title="重置为默认"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <kbd
                onClick={() => item.customizable && handleStartEdit(item)}
                className={`inline-block px-2 py-0.5 text-xs font-mono rounded border min-w-[90px] text-center transition-colors ${
                  item.customizable
                    ? 'cursor-pointer hover:border-[var(--accent-500)] hover:text-[var(--accent-500)]'
                    : 'cursor-default opacity-60'
                } ${
                  isCustom
                    ? 'bg-[var(--accent-500)]/10 text-[var(--accent-500)] border-[var(--accent-500)]/40'
                    : 'bg-[var(--editor-code-bg)] text-[var(--editor-text-secondary)] border-[var(--editor-border)]'
                }`}
              >
                {currentKey}
              </kbd>
              {isCustom && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[var(--accent-500)]" />
              )}
            </div>
          )}
        </div>
        {conflictWarning && editingId === item.id && (
          <div className="mt-1 ml-2 px-2 py-1 text-xs text-[var(--error-500)] bg-[var(--error-500)]/10 rounded-md">
            ⚠ {conflictWarning}
          </div>
        )}
      </div>
    );
  };

  const panelContent = (
    <div>
      {mode === 'dialog' && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--accent-500)]" />
            <h2 className="text-base font-semibold text-[var(--editor-text)]">键盘快捷键</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetAll}
              className="px-2 py-1 text-xs text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] rounded-md hover:bg-[var(--sidebar-hover)] transition-colors flex items-center gap-1"
            >
              <RotateCcw size={12} />
              全部重置
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={mode === 'dialog' ? 'p-4 overflow-y-auto max-h-[calc(80vh-60px)]' : 'overflow-y-auto'}>
        {SHORTCUT_CATEGORIES.map((category) => (
          <div key={category.id} className="mb-4 last:mb-0">
            <h3 className="text-xs font-semibold text-[var(--editor-text-secondary)] uppercase tracking-wider mb-2">
              {category.label}
            </h3>
            <div className="space-y-0.5">
              {category.items.map(renderItem)}
            </div>
          </div>
        ))}
        {mode === 'embedded' && (
          <p className="text-xs text-[var(--editor-text-muted)] mt-3 px-2">
            点击快捷键即可编辑，按 Esc 取消
          </p>
        )}
      </div>
    </div>
  );

  if (mode === 'embedded') {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-[var(--accent-400)]" />
            <h3 className="text-sm font-medium text-[var(--editor-text)]">快捷键设置</h3>
          </div>
          <button
            onClick={handleResetAll}
            className="px-2 py-1 text-xs text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] rounded-md hover:bg-[var(--sidebar-hover)] transition-colors flex items-center gap-1"
          >
            <RotateCcw size={12} />
            全部重置
          </button>
        </div>
        {panelContent}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] w-[520px] max-h-[80vh] overflow-hidden animate-scale-in">
        {panelContent}
      </div>
    </div>
  );
};
