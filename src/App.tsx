import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme } from './hooks';
import { waitForTauri, isTauriCached } from './utils/platform';
import { useEditorStore, useUpdateStore } from './stores';

function App() {
  const [isReady, setIsReady] = useState(false);
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);

  useTheme();
  
  useEffect(() => {
    const init = async () => {
      await waitForTauri();
      (window as any).__TAURI_READY__ = true;
      setIsReady(true);
    };
    
    init();
  }, []);
  
  useEffect(() => {
    const handleGlobalDrop = async (e: DragEvent) => {
      if (isTauriCached()) {
        e.preventDefault();
        return;
      }
      
      const target = e.target as HTMLElement;
      if (target.closest('.pane-leaf')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer?.files;
      if (!files) return;
      
      const { openDocument } = useEditorStore.getState();
      for (const file of Array.from(files)) {
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
          const content = await file.text();
          const filePath = (file as any).path || file.name;
          openDocument(`file://${filePath}`, content, false);
        }
      }
    };
    
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    
    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, []);

  useEffect(() => {
    if (!isTauriCached()) return;
    
    let unlisten: (() => void) | null = null;
    
    const setupTauriDragDrop = async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const unlistenFn = await getCurrentWindow().onDragDropEvent(async (event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            const position = event.payload.position;
            
            const x = position.x;
            const y = position.y;
            
            const allPanes = document.querySelectorAll('.pane-leaf');
            let targetPane: HTMLElement | null = null;
            
            for (const pane of Array.from(allPanes)) {
              const rect = pane.getBoundingClientRect();
              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                targetPane = pane as HTMLElement;
                break;
              }
            }
            
            if (targetPane) {
              const paneId = targetPane.getAttribute('data-pane-id');
              const tabPath = targetPane.getAttribute('data-tab-path');
              
              if (paneId && tabPath) {
                const { ensureDocument } = useEditorStore.getState();
                const splitStore = await import('./stores').then(m => m.useSplitStore.getState());
                const { setPaneDocument, setActivePane, getDocumentsInPanes } = splitStore;
                
                const existingDocs = getDocumentsInPanes(tabPath);
                
                for (const path of paths) {
                  if (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt')) {
                    const docPath = `file://${path}`;
                    
                    if (existingDocs.includes(docPath)) continue;
                    
                    try {
                      const { readTextFile } = await import('@tauri-apps/plugin-fs');
                      const content = await readTextFile(path);
                      ensureDocument(docPath, content, false);
                      setPaneDocument(tabPath, paneId, docPath);
                      setActivePane(tabPath, paneId);
                    } catch (err) {
                      console.error('在窗格中打开拖放文件失败:', err);
                    }
                  }
                }
                return;
              }
            }
            
            const { openDocument } = useEditorStore.getState();
            for (const path of paths) {
              if (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt')) {
                try {
                  const { readTextFile } = await import('@tauri-apps/plugin-fs');
                  const content = await readTextFile(path);
                  openDocument(`file://${path}`, content, false);
                } catch (err) {
                  console.error('读取拖放文件失败:', err);
                }
              }
            }
          }
        });
        unlisten = unlistenFn;
      } catch (err) {
        console.error('设置Tauri拖放监听失败:', err);
      }
    };
    
    setupTauriDragDrop();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdate();
    }, 5000);

    const interval = setInterval(() => {
      checkForUpdate();
    }, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  if (!isReady) {
    return (
      <div style={{ 
        padding: 20, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100vh',
        fontSize: 14,
        color: '#666'
      }}>
        正在初始化...
      </div>
    );
  }
  
  return <Layout />;
}

export default App;