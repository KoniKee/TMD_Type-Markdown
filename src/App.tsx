import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme } from './hooks';
import { waitForTauri, isTauriCached } from './utils/platform';
import { useEditorStore, useUpdateStore, useSettingsStore } from './stores';

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
      const target = e.target as HTMLElement;
      
      if (target.closest('.pane-leaf')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
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

  useEffect(() => {
    if (!isReady || !isTauriCached()) return;
    
    let unlisten: (() => void) | null = null;
    
    const setupFileOpenListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        const { invoke } = await import('@tauri-apps/api/core');
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        
        const openFile = async (filePath: string) => {
          try {
            const content = await readTextFile(filePath);
            const { openDocument } = useEditorStore.getState();
            openDocument(`file://${filePath}`, content, false);
          } catch (err) {
            console.error('打开文件失败:', err);
          }
        };

        unlisten = await listen<string>('file-open', async (event) => {
          await openFile(event.payload);
        });

        const pendingFile = await invoke<string | null>('get_pending_file');
        if (pendingFile) {
          await openFile(pendingFile);
          await invoke('clear_pending_file');
        }
      } catch (err) {
        console.error('设置文件打开监听失败:', err);
      }
    };
    
    setupFileOpenListener();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [isReady]);

  // 禁用默认右键菜单（仅桌面版）
  useEffect(() => {
    if (!isTauriCached()) return;
    
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 如果点击的是自定义菜单项，不阻止
      if (target.closest('.context-menu') || target.closest('[data-context-menu]')) {
        return;
      }
      
      // 阻止默认的浏览器右键菜单
      e.preventDefault();
    };
    
    document.addEventListener('contextmenu', handleContextMenu);
    
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  // 全局行高设置
  useEffect(() => {
    const lineHeight = useSettingsStore.getState().lineHeight;
    
    // 创建全局样式元素
    let styleEl = document.getElementById('global-line-height-style') as HTMLStyleElement;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'global-line-height-style';
      document.head.appendChild(styleEl);
    }
    
    // 更新样式
    styleEl.textContent = `.vditor-reset { line-height: ${lineHeight} !important; }`;
    
    // 监听行高变化
    const unsubscribe = useSettingsStore.subscribe((state) => {
      const newLineHeight = state.lineHeight;
      styleEl.textContent = `.vditor-reset { line-height: ${newLineHeight} !important; }`;
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

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
