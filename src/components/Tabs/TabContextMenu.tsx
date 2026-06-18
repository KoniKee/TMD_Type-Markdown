import React, { useEffect, useRef, useState } from 'react';
import { X, XCircle, ArrowRight, ArrowLeft, XSquare } from 'lucide-react';
import { useEditorStore } from '../../stores';
import { getFileName } from '../../hooks/useAutoSave';
import { BatchCloseConfirm } from './BatchCloseConfirm';
import { LucideIcon } from 'lucide-react';

interface TabContextMenuProps {
  x: number;
  y: number;
  tabPath: string;
  onClose: () => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  x,
  y,
  tabPath,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const tabs = useEditorStore((state) => state.tabs);
  const documents = useEditorStore((state) => state.documents);
  const closeDocument = useEditorStore((state) => state.closeDocument);
  const closeOtherTabs = useEditorStore((state) => state.closeOtherTabs);
  const closeTabsToRight = useEditorStore((state) => state.closeTabsToRight);
  const closeTabsToLeft = useEditorStore((state) => state.closeTabsToLeft);
  const closeAllTabs = useEditorStore((state) => state.closeAllTabs);
  
  const [batchCloseConfirm, setBatchCloseConfirm] = useState<{
    paths: string[];
    action: () => void;
  } | null>(null);
  
  const pathIndex = tabs.indexOf(tabPath);
  const hasRightTabs = pathIndex < tabs.length - 1;
  const hasLeftTabs = pathIndex > 0;
  
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
  
  const getUnsavedDocs = (paths: string[]): string[] => {
    return paths
      .filter(p => documents[p]?.isModified)
      .map(p => getFileName(p));
  };
  
  const handleBatchClose = (paths: string[], action: () => void) => {
    const unsavedDocs = getUnsavedDocs(paths);
    if (unsavedDocs.length > 0) {
      setBatchCloseConfirm({ paths: unsavedDocs, action });
    } else {
      action();
      onClose();
    }
  };
  
  const handleCloseCurrent = () => {
    closeDocument(tabPath);
    onClose();
  };
  
  const handleCloseOther = () => {
    const otherPaths = tabs.filter(t => t !== tabPath);
    handleBatchClose(otherPaths, () => closeOtherTabs(tabPath));
  };
  
  const handleCloseRight = () => {
    const rightPaths = tabs.slice(pathIndex + 1);
    handleBatchClose(rightPaths, () => closeTabsToRight(tabPath));
  };
  
  const handleCloseLeft = () => {
    const leftPaths = tabs.slice(0, pathIndex);
    handleBatchClose(leftPaths, () => closeTabsToLeft(tabPath));
  };
  
  const handleCloseAll = () => {
    handleBatchClose(tabs, () => closeAllTabs());
  };
  
  const menuItems: { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }[] = [
    { icon: X, label: '关闭', onClick: handleCloseCurrent },
    { icon: XCircle, label: '关闭其他', onClick: handleCloseOther, disabled: tabs.length <= 1 },
    { icon: ArrowRight, label: '关闭右侧', onClick: handleCloseRight, disabled: !hasRightTabs },
    { icon: ArrowLeft, label: '关闭左侧', onClick: handleCloseLeft, disabled: !hasLeftTabs },
    { icon: XSquare, label: '关闭所有', onClick: handleCloseAll, danger: true },
  ];
  
  return (
    <>
      <div
        ref={menuRef}
        className="fixed z-50 bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-lg shadow-2xl py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        {menuItems.map((item, index) => (
          <button
            key={index}
            className={`w-full px-3 py-2 text-sm text-left hover:bg-[var(--sidebar-hover)] flex items-center gap-2.5 transition-colors ${item.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${item.danger ? 'text-[var(--error-500)]' : ''}`}
            onClick={item.disabled ? undefined : item.onClick}
            disabled={item.disabled}
          >
            <item.icon size={14} className={item.danger ? 'text-[var(--error-500)]' : 'text-[var(--sidebar-text-muted)]'} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      
      {batchCloseConfirm && (
        <BatchCloseConfirm
          documents={batchCloseConfirm.paths}
          onConfirm={() => {
            batchCloseConfirm.action();
            setBatchCloseConfirm(null);
            onClose();
          }}
          onCancel={() => {
            setBatchCloseConfirm(null);
          }}
        />
      )}
    </>
  );
};

export default TabContextMenu;
