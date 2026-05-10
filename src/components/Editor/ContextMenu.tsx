import React, { useEffect, useRef } from 'react';
import { FilePlus, FileText, X, Columns } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  hasDocument: boolean;
  canClosePane: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onCloseDocument: () => void;
  onClosePane: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  hasDocument,
  canClosePane,
  onNewFile,
  onOpenFile,
  onCloseDocument,
  onClosePane,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 8;
      }
      if (y + rect.height > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 8;
      }

      menuRef.current.style.left = `${adjustedX}px`;
      menuRef.current.style.top = `${adjustedY}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[200] min-w-[160px] py-1 rounded-lg shadow-xl border animate-scale-in"
      style={{
        backgroundColor: 'var(--editor-bg)',
        borderColor: 'var(--editor-border)',
        left: x,
        top: y,
      }}
    >
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--editor-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
        onClick={() => {
          onNewFile();
          onClose();
        }}
      >
        <FilePlus size={16} />
        <span>新建文档</span>
      </button>
      <button
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--editor-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
        onClick={() => {
          onOpenFile();
          onClose();
        }}
      >
        <FileText size={16} />
        <span>打开文件...</span>
      </button>
      
      <div className="my-1 border-t border-[var(--editor-border)]" />
      
      {hasDocument && (
        <button
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--editor-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
          onClick={() => {
            onCloseDocument();
            onClose();
          }}
        >
          <X size={16} />
          <span>关闭文档</span>
        </button>
      )}
      {canClosePane && (
        <button
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[var(--editor-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
          onClick={() => {
            onClosePane();
            onClose();
          }}
        >
          <Columns size={16} />
          <span>关闭窗格</span>
        </button>
      )}
    </div>
  );
};

export default ContextMenu;
