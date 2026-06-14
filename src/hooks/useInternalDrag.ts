import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore, useSplitStore } from '../stores';
import { isTauriCached } from '../utils/platform';

interface DragState {
  isDragging: boolean;
  docPath: string | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const DRAG_THRESHOLD = 10;

export function useInternalDrag() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    docPath: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });
  
  const dragRef = useRef<DragState>(dragState);
  dragRef.current = dragState;
  
  const isDragTriggeredRef = useRef(false);
  
  const startDrag = useCallback((e: React.PointerEvent, docPath: string) => {
    if (!isTauriCached()) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    
    isDragTriggeredRef.current = false;
    
    setDragState({
      isDragging: true,
      docPath,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
    });
    
    (window as any).__internalDragPath__ = docPath;
  }, []);
  
  const updateDrag = useCallback((e: PointerEvent) => {
    const state = dragRef.current;
    if (!state.isDragging) return;
    
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > DRAG_THRESHOLD) {
      isDragTriggeredRef.current = true;
    }
    
    setDragState(prev => ({
      ...prev,
      currentX: e.clientX,
      currentY: e.clientY,
    }));
  }, []);
  
  const endDrag = useCallback(async (e: PointerEvent) => {
    const state = dragRef.current;
    if (!state.isDragging || !state.docPath) {
      (window as any).__internalDragPath__ = null;
      return;
    }
    
    setDragState({
      isDragging: false,
      docPath: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
    });
    
    (window as any).__internalDragPath__ = null;
    
    if (!isDragTriggeredRef.current) return;
    
    const targetElement = document.elementFromPoint(e.clientX, e.clientY);
    const paneLeaf = targetElement?.closest('.pane-leaf');
    const paneId = paneLeaf?.getAttribute('data-pane-id');
    const paneTabPath = paneLeaf?.getAttribute('data-tab-path');
    
    if (!paneId || !paneTabPath) return;
    
    const { ensureDocument } = useEditorStore.getState();
    const { setPaneDocument, getDocumentsInPanes, setActivePane } = useSplitStore.getState();
    
    const existingDocs = getDocumentsInPanes(paneTabPath);
    if (existingDocs.includes(state.docPath)) return;
    
    try {
      const realPath = state.docPath.replace(/^file:\/\//, '');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(realPath);
      ensureDocument(state.docPath, content, false);
      setPaneDocument(paneTabPath, paneId, state.docPath);
      setActivePane(paneTabPath, paneId);
    } catch (err) {
      console.error('打开文件失败:', err);
    }
  }, []);
  
  useEffect(() => {
    if (!isTauriCached()) return;
    
    document.addEventListener('pointermove', updateDrag);
    document.addEventListener('pointerup', endDrag);
    return () => {
      document.removeEventListener('pointermove', updateDrag);
      document.removeEventListener('pointerup', endDrag);
    };
  }, [updateDrag, endDrag]);
  
  return {
    dragState,
    startDrag,
    isTauri: isTauriCached(),
    isDragTriggered: isDragTriggeredRef,
  };
}
