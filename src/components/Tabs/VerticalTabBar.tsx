import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useEditorStore, useSplitStore } from '../../stores';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores';
import { getFileName } from '../../hooks/useAutoSave';
import { useFileOperations } from '../../hooks/useFileOperations';
import { FileText, X, Plus, PanelRightClose } from 'lucide-react';
import { TabContextMenu } from './TabContextMenu';
import { CloseTabConfirm } from '../Editor/CloseTabConfirm';

export const VerticalTabBar: React.FC = () => {
  const tabs = useEditorStore((state) => state.tabs);
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const activeTabPath = useEditorStore((state) => state.activeTabPath);
  const documents = useEditorStore((state) => state.documents);
  const setActiveDocument = useEditorStore((state) => state.setActiveDocument);
  const closeDocument = useEditorStore((state) => state.closeDocument);
  const reorderTabs = useEditorStore((state) => state.reorderTabs);

  const verticalTabWidth = useLayoutStore((s) => s.verticalTabWidth);
  const setVerticalTabWidth = useLayoutStore((s) => s.setVerticalTabWidth);
  const setTabBarStyle = useSettingsStore((s) => s.setTabBarStyle);

  const { handleNewFile } = useFileOperations();

  const getPaneCount = useSplitStore((state) => state.getPaneCount);

  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [contextMenu, setContextMenu] = useState<{ path: string; x: number; y: number } | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [pendingCloseTab, setPendingCloseTab] = useState('');
  const [pendingCloseDocuments, setPendingCloseDocuments] = useState<string[]>([]);

  const [dragState, setDragState] = useState({
    isDragging: false,
    dragPath: null as string | null,
    dragOverIndex: null as number | null,
  });
  const [dragGhost, setDragGhost] = useState<{ name: string; y: number } | null>(null);
  const dragInfoRef = useRef({
    startY: 0,
    hasMoved: false,
    dragPath: null as string | null,
    dragIndex: -1,
  });
  const dragOverIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!showCloseConfirm) {
      setPendingCloseTab('');
      setPendingCloseDocuments([]);
    }
  }, [showCloseConfirm]);

  const handleCloseTab = useCallback((tabPath: string) => {
    const paneCount = getPaneCount(tabPath);
    if (paneCount > 1) {
      const store = useSplitStore.getState();
      const docsInPanes = store.getDocumentsInPanes(tabPath);
      setPendingCloseTab(tabPath);
      setPendingCloseDocuments(docsInPanes.length > 0 ? docsInPanes : [tabPath]);
      setShowCloseConfirm(true);
    } else {
      closeDocument(tabPath);
    }
  }, [closeDocument, getPaneCount]);

  const handleConfirmClose = useCallback(() => {
    if (pendingCloseDocuments.length > 0) {
      const { documents } = useEditorStore.getState();
      const remaining = { ...documents };
      for (const docPath of pendingCloseDocuments) {
        delete remaining[docPath];
      }
      useEditorStore.setState({ documents: remaining });
    }
    closeDocument(pendingCloseTab);
    setShowCloseConfirm(false);
  }, [closeDocument, pendingCloseDocuments, pendingCloseTab]);

  const handleCancelClose = useCallback(() => {
    setShowCloseConfirm(false);
  }, []);

  const startTabDrag = useCallback((e: React.MouseEvent, tabPath: string, index: number) => {
    if (e.button !== 0) return;

    dragInfoRef.current = { startY: e.clientY, hasMoved: false, dragPath: tabPath, dragIndex: index };
    dragOverIndexRef.current = index;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dy = moveEvent.clientY - dragInfoRef.current.startY;
      if (!dragInfoRef.current.hasMoved && Math.abs(dy) < 5) return;
      dragInfoRef.current.hasMoved = true;

      setDragGhost({ name: getFileName(tabPath), y: moveEvent.clientY });

      let overIndex = index;
      for (const [path, el] of tabRefs.current) {
        const rect = el.getBoundingClientRect();
        if (moveEvent.clientY >= rect.top && moveEvent.clientY <= rect.bottom) {
          const midY = rect.top + rect.height / 2;
          const pathIdx = useEditorStore.getState().tabs.indexOf(path);
          overIndex = moveEvent.clientY < midY ? pathIdx : pathIdx + 1;
          break;
        }
      }
      dragOverIndexRef.current = overIndex;

      setDragState(prev =>
        !prev.isDragging
          ? { isDragging: true, dragPath: tabPath, dragOverIndex: overIndex }
          : { ...prev, dragOverIndex: overIndex }
      );
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (dragInfoRef.current.hasMoved && dragInfoRef.current.dragPath) {
        const state = useEditorStore.getState();
        const fromIndex = state.tabs.indexOf(dragInfoRef.current.dragPath);
        let toIndex = dragOverIndexRef.current ?? fromIndex;
        if (toIndex > fromIndex) toIndex--;
        if (fromIndex !== toIndex && fromIndex >= 0) {
          reorderTabs(fromIndex, toIndex);
        }
      }
      setDragState({ isDragging: false, dragPath: null, dragOverIndex: null });
      setDragGhost(null);
      dragInfoRef.current = { startY: 0, hasMoved: false, dragPath: null, dragIndex: -1 };
      dragOverIndexRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [reorderTabs]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = verticalTabWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      setVerticalTabWidth(startWidth + diff);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [verticalTabWidth, setVerticalTabWidth]);

  return (
    <div
      className="flex flex-col h-full bg-[var(--titlebar-bg)] border-r border-[var(--editor-border)] relative"
      style={{ width: verticalTabWidth }}
    >
      {/* 标签列表 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center h-full px-3">
            <span className="text-xs text-[var(--editor-text-muted)] text-center">
              暂无打开的文档
            </span>
          </div>
        ) : (
          tabs.map((tabPath, index) => {
            const isActive = tabPath === activeTabPath;
            const displayFileName = getFileName(tabPath);
            const doc = documents[tabPath];
            const isModified = doc?.isModified || false;

            return (
              <div key={tabPath}>
                {dragState.isDragging && dragState.dragOverIndex === index && dragState.dragPath !== tabPath && (
                  <div className="h-0.5 bg-[var(--accent-500)] rounded-full mx-3 my-0.5" />
                )}
                <div
                  ref={(el) => {
                    if (el) tabRefs.current.set(tabPath, el);
                    else tabRefs.current.delete(tabPath);
                  }}
                  className={`
                    group relative flex items-center h-[34px] mx-1.5 px-2.5 rounded-md cursor-pointer
                    transition-all duration-[var(--transition-fast)]
                    ${isActive
                      ? 'bg-[var(--tab-active-bg)] text-[var(--editor-text)] font-medium shadow-[inset_2px_0_0_0_var(--tab-active-indicator)]'
                      : 'text-[var(--editor-text-secondary)] hover:bg-[var(--tab-hover-bg)] hover:text-[var(--editor-text)]'
                    }
                    ${dragState.isDragging && dragState.dragPath === tabPath ? 'opacity-50' : ''}
                  `}
                  onClick={(e) => {
                    if (dragInfoRef.current.hasMoved) return;
                    e.stopPropagation();
                    setActiveDocument(tabPath);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    if (e.button === 1) {
                      e.preventDefault();
                      handleCloseTab(tabPath);
                      return;
                    }
                    if (e.button === 0) {
                      startTabDrag(e, tabPath, index);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setContextMenu({ path: tabPath, x: e.clientX, y: e.clientY });
                  }}
                >
                  <FileText
                    size={14}
                    className={`mr-1.5 flex-shrink-0 ${isActive ? 'text-[var(--accent-500)]' : 'text-[var(--editor-text-muted)]'}`}
                  />

                  {isModified && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-500)] mr-1.5 flex-shrink-0" />
                  )}

                  <span
                    className="text-sm truncate flex-1"
                    title={tabPath.replace(/^file:\/\//, '')}
                  >
                    {displayFileName}
                  </span>

                  <button
                    className={`
                      ml-1 p-0.5 rounded flex-shrink-0
                      opacity-0 group-hover:opacity-100
                      hover:bg-[var(--sidebar-hover)]
                      text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]
                      transition-all
                    `}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tabPath);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
                {dragState.isDragging && dragState.dragOverIndex === index + 1 && dragState.dragPath !== tabPath && (
                  <div className="h-0.5 bg-[var(--accent-500)] rounded-full mx-3 my-0.5" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部操作区 */}
      <div className="flex-shrink-0 border-t border-[var(--editor-border)]">
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] hover:bg-[var(--tab-hover-bg)] transition-colors"
          onClick={(e) => { e.stopPropagation(); handleNewFile(); }}
          title="新建文档"
        >
          <Plus size={14} />
          <span>新建标签</span>
        </button>
        <button
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] hover:bg-[var(--tab-hover-bg)] transition-colors border-t border-[var(--editor-border)]"
          onClick={() => setTabBarStyle('horizontal')}
          title="切换到水平标签栏"
        >
          <PanelRightClose size={14} />
          <span>切换水平标签</span>
        </button>
      </div>

      {/* 右侧宽度拖拽手柄 */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10"
        onMouseDown={handleResizeStart}
      >
        <div className="w-px h-full bg-[var(--editor-border)] group-hover:bg-[var(--accent-500)] group-hover:w-0.5 transition-colors" />
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <TabContextMenu
          tabPath={contextMenu.path}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 关闭确认对话框 */}
      {showCloseConfirm && (
        <CloseTabConfirm
          documents={pendingCloseDocuments.length > 0 ? pendingCloseDocuments : [pendingCloseTab]}
          onConfirm={handleConfirmClose}
          onCancel={handleCancelClose}
        />
      )}

      {/* 拖拽幽灵 */}
      {dragGhost && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-md bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] shadow-lg text-sm text-[var(--editor-text)] opacity-90"
          style={{ left: 20, top: dragGhost.y - 18 }}
        >
          {dragGhost.name}
        </div>
      )}
    </div>
  );
};
