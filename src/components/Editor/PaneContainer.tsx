import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useSplitStore, useEditorStore, useFileStore, Pane, PaneLeaf, PaneSplit, SplitDirection } from '../../stores';
import { VditorEditor } from './VditorEditor';
import { PaneWelcome } from './PaneWelcome';
import { ContextMenu } from './ContextMenu';
import { useFileOperations } from '../../hooks/useFileOperations';
import { isTauriCached } from '../../utils/platform';
import '../../styles/split.css';

interface PaneContainerProps {
  tabPath: string;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  paneId: string;
  hasDocument: boolean;
}

interface DragState {
  isOver: boolean;
  paneId: string;
}

export const PaneContainer: React.FC<PaneContainerProps> = ({ tabPath }) => {
  const splitState = useSplitStore((state) => state.getCurrentState(tabPath));
  const activePaneId = splitState?.activePaneId;
  const initTabSplitState = useSplitStore((state) => state.initTabSplitState);
  const splitPaneAction = useSplitStore((state) => state.splitPane);
  const closePane = useSplitStore((state) => state.closePane);
  const setPaneDocument = useSplitStore((state) => state.setPaneDocument);
  const setActivePane = useSplitStore((state) => state.setActivePane);
  const setSplitRatio = useSplitStore((state) => state.setSplitRatio);
  const getPaneCount = useSplitStore((state) => state.getPaneCount);
  const getDocumentsInPanes = useSplitStore((state) => state.getDocumentsInPanes);
  const ensureDocument = useEditorStore((state) => state.ensureDocument);
  const setActiveTab = useEditorStore((state) => state.setActiveTab);
  const getFileHandle = useFileStore((state) => state.getFileHandle);
  const { handleOpenFile: openFileFromOps } = useFileOperations();
  
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    paneId: '',
    hasDocument: false,
  });
  
  const [dragState, setDragState] = useState<DragState>({
    isOver: false,
    paneId: '',
  });
  
  const draggingRef = useRef<{
    splitPaneId: string;
    startX: number;
    startY: number;
    startRatio: number;
    direction: SplitDirection;
  } | null>(null);
  
  useEffect(() => {
    if (!splitState) {
      const doc = useEditorStore.getState().documents[tabPath];
      initTabSplitState(tabPath, doc ? tabPath : '');
    }
  }, [tabPath, splitState, initTabSplitState]);
  
  const handlePaneClick = useCallback((paneId: string) => {
    setActiveTab(tabPath);
    if (splitState && paneId !== splitState.activePaneId) {
      setActivePane(tabPath, paneId);
    }
  }, [tabPath, splitState, setActivePane, setActiveTab]);
  
  const handleContextMenu = useCallback((e: React.MouseEvent, paneId: string, docPath: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      paneId,
      hasDocument: docPath !== null,
    });
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
  }, []);
  
  const handleNewFile = useCallback(() => {
    const fileName = `新建文档-${Date.now()}.md`;
    const content = `# 新建文档\n\n在这里开始写作...\n`;
    ensureDocument(fileName, content, true);
    
    const newDocPath = fileName;
    setTimeout(() => {
      setPaneDocument(tabPath, contextMenu.paneId, newDocPath);
      setActivePane(tabPath, contextMenu.paneId);
    }, 50);
  }, [tabPath, contextMenu.paneId, ensureDocument, setPaneDocument, setActivePane]);
  
  const handleOpenFileInPane = useCallback((paneId: string) => {
    openFileFromOps((docPath: string) => {
      setTimeout(() => {
        setPaneDocument(tabPath, paneId, docPath);
        setActivePane(tabPath, paneId);
      }, 50);
    });
  }, [tabPath, openFileFromOps, setPaneDocument, setActivePane]);
  
  const handleOpenFileFromContextMenu = useCallback(() => {
    openFileFromOps((docPath: string) => {
      setTimeout(() => {
        setPaneDocument(tabPath, contextMenu.paneId, docPath);
        setActivePane(tabPath, contextMenu.paneId);
      }, 50);
    });
  }, [tabPath, contextMenu.paneId, openFileFromOps, setPaneDocument, setActivePane]);
  
  const handleCloseDocument = useCallback(() => {
    setPaneDocument(tabPath, contextMenu.paneId, null);
  }, [tabPath, contextMenu.paneId, setPaneDocument]);
  
  const handleClosePane = useCallback(() => {
    closePane(tabPath, contextMenu.paneId);
  }, [tabPath, contextMenu.paneId, closePane]);
  
  const handleDragOver = useCallback((e: React.DragEvent, paneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragState({ isOver: true, paneId });
  }, []);
  
  const handleDragLeave = useCallback(() => {
    setDragState({ isOver: false, paneId: '' });
  }, []);
  
  const handleDrop = useCallback(async (e: React.DragEvent, paneId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ isOver: false, paneId: '' });
    
    let docPath: string | null = null;
    
    const types = e.dataTransfer.types;
    let internalDragData: string | null = null;
    if (types.includes('application/x-file-path')) {
      internalDragData = e.dataTransfer.getData('application/x-file-path');
    } else if (types.includes('text/plain')) {
      internalDragData = e.dataTransfer.getData('text/plain');
    }
    
    if (internalDragData && internalDragData.startsWith('file://')) {
      docPath = internalDragData;
    } else {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith('.md') || f.name.endsWith('.markdown') || f.name.endsWith('.txt')
      );
      if (files.length > 0) {
        docPath = `file://${files[0].name}`;
      }
    }
    
    if (!docPath) return;
    
    const existingDocs = getDocumentsInPanes(tabPath);
    if (existingDocs.includes(docPath)) return;
    
    let content: string | null = null;
    
    if (internalDragData && internalDragData.startsWith('file://')) {
      const realPath = internalDragData.replace(/^file:\/\//, '');
      try {
        if (isTauriCached()) {
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          content = await readTextFile(realPath);
        } else {
          const handle = getFileHandle(realPath) || getFileHandle(realPath.replace(/\\/g, '/'));
          if (handle && handle.kind === 'file') {
            const file = await handle.getFile();
            content = await file.text();
          }
        }
      } catch (err) {
        console.error('从文件树拖放打开文件失败:', err);
        return;
      }
    } else {
      const files = Array.from(e.dataTransfer.files).filter(f => 
        f.name.endsWith('.md') || f.name.endsWith('.markdown') || f.name.endsWith('.txt')
      );
      if (files.length > 0) {
        content = await files[0].text();
      }
    }
    
    if (content !== null) {
      ensureDocument(docPath, content, false);
      setPaneDocument(tabPath, paneId, docPath);
      setActivePane(tabPath, paneId);
    }
  }, [tabPath, ensureDocument, setPaneDocument, setActivePane, getFileHandle, getDocumentsInPanes]);
  
  const handleDividerMouseDown = useCallback((
    e: React.MouseEvent,
    splitPaneId: string,
    direction: SplitDirection,
    currentRatio: number
  ) => {
    e.preventDefault();
    draggingRef.current = {
      splitPaneId,
      startX: e.clientX,
      startY: e.clientY,
      startRatio: currentRatio,
      direction,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!draggingRef.current) return;
      
      const { startX, startY, startRatio, direction, splitPaneId: id } = draggingRef.current;
      
      const container = (e.target as HTMLElement).closest('.pane-container');
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      
      let newRatio: number;
      if (direction === 'vertical') {
        const deltaX = moveEvent.clientX - startX;
        const containerWidth = rect.width;
        const ratioDelta = deltaX / containerWidth;
        newRatio = startRatio + ratioDelta;
      } else {
        const deltaY = moveEvent.clientY - startY;
        const containerHeight = rect.height;
        const ratioDelta = deltaY / containerHeight;
        newRatio = startRatio + ratioDelta;
      }
      
      setSplitRatio(tabPath, id, newRatio);
    };
    
    const handleMouseUp = () => {
      draggingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [tabPath, setSplitRatio]);
  
  if (!splitState) {
    return null;
  }
  
  const paneCount = getPaneCount(tabPath);
  const canClosePane = paneCount > 1;
  
  const renderPane = (pane: Pane): React.ReactNode => {
    if (pane.type === 'leaf') {
      const isActive = pane.id === activePaneId;
      const isDragOver = dragState.isOver && dragState.paneId === pane.id;
      
      return (
        <div
          key={pane.id}
          className={`pane-leaf ${isActive && paneCount > 1 ? 'active' : ''} ${isDragOver ? 'drag-over' : ''}`}
          onClick={() => handlePaneClick(pane.id)}
          onContextMenu={(e) => handleContextMenu(e, pane.id, pane.docPath)}
          onDragOver={(e) => handleDragOver(e, pane.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, pane.id)}
        >
          {pane.docPath ? (
            <VditorEditor key={pane.docPath} path={pane.docPath} />
          ) : (
            <PaneWelcome
              onNewFile={() => {
                const fileName = `新建文档-${Date.now()}.md`;
                const content = `# 新建文档\n\n在这里开始写作...\n`;
                ensureDocument(fileName, content, true);
                setTimeout(() => {
                  setPaneDocument(tabPath, pane.id, fileName);
                  setActivePane(tabPath, pane.id);
                }, 50);
              }}
              onOpenFile={() => handleOpenFileInPane(pane.id)}
            />
          )}
        </div>
      );
    }
    
    const splitNode = pane as PaneSplit;
    const [firstChild, secondChild] = splitNode.children;
    const isActive = splitNode.id === activePaneId;
    
    return (
      <div
        key={splitNode.id}
        className={`pane-container ${splitNode.direction} flex-1 min-w-0 min-h-0`}
      >
        {renderPane(firstChild)}
        <div
          className={`pane-divider ${splitNode.direction} ${isActive ? 'active' : ''}`}
          onMouseDown={(e) => handleDividerMouseDown(e, splitNode.id, splitNode.direction, splitNode.ratio)}
        />
        {renderPane(secondChild)}
      </div>
    );
  };
  
  return (
    <>
      <div className="pane-container vertical h-full w-full">
        {renderPane(splitState.paneTree)}
      </div>
      
      {contextMenu.visible && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasDocument={contextMenu.hasDocument}
          canClosePane={canClosePane}
          onNewFile={handleNewFile}
          onOpenFile={handleOpenFileFromContextMenu}
          onCloseDocument={handleCloseDocument}
          onClosePane={handleClosePane}
          onClose={closeContextMenu}
        />
      )}
    </>
  );
};

export default PaneContainer;
