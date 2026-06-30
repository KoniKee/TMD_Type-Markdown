import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme, useFileOperations } from './hooks';
import { waitForTauri, isTauriCached } from './utils/platform';
import { useEditorStore, useUpdateStore, useSettingsStore, useFileStore, useSplitStore } from './stores';

function App() {
  const [isReady, setIsReady] = useState(false);
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);
  const { readDirectoryTauri, readDirectoryRecursive } = useFileOperations();
  const { setRootPath, setFileTree, setRootHandle, clearAll } = useFileStore();

  useTheme();
  
  useEffect(() => {
    const init = async () => {
      await waitForTauri();
      (window as any).__TAURI_READY__ = true;
      setIsReady(true);
    };
    
    init();
  }, []);
  
  // Tauri 原生拖拽事件处理（仅桌面版）
  useEffect(() => {
    if (!isReady || !isTauriCached()) return;
    
    let unlisten: (() => void) | null = null;
    
    const setupTauriDragDrop = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const { readTextFile, stat } = await import('@tauri-apps/plugin-fs');
        
        unlisten = await getCurrentWebviewWindow().onDragDropEvent(async (event) => {
          // 处理 over 事件：显示窗格焦点效果并追踪窗格
          if (event.payload.type === 'over') {
            const { x, y } = event.payload.position;
            // 将物理像素转换为 CSS 像素（逻辑像素）
            const dpr = window.devicePixelRatio || 1;
            const logicalX = x / dpr;
            const logicalY = y / dpr;
            
            const targetElement = document.elementFromPoint(logicalX, logicalY);
            const paneLeaf = targetElement?.closest('.pane-leaf');
            const paneId = paneLeaf?.getAttribute('data-pane-id');
            const paneTabPath = paneLeaf?.getAttribute('data-tab-path');
            
            // 记录当前追踪到的窗格信息
            if (paneId && paneTabPath) {
              (window as any).__dragOverPaneInfo__ = { paneId, paneTabPath };
            }
            
            // 更新所有窗格的拖拽状态
            document.querySelectorAll('.pane-leaf').forEach((pane) => {
              if (paneId && pane.getAttribute('data-pane-id') === paneId) {
                pane.classList.add('drag-over');
              } else {
                pane.classList.remove('drag-over');
              }
            });
            return;
          }
          
          // 处理 leave 事件：清除窗格焦点效果
          if (event.payload.type === 'leave') {
            (window as any).__dragOverPaneInfo__ = null;
            document.querySelectorAll('.pane-leaf').forEach((pane) => {
              pane.classList.remove('drag-over');
            });
            return;
          }
          
          // 处理 drop 事件
          if (event.payload.type !== 'drop') return;
          
          const paths = event.payload.paths;
          
          // 清除窗格焦点效果
          document.querySelectorAll('.pane-leaf').forEach((pane) => {
            pane.classList.remove('drag-over');
          });
          
          // 使用追踪的窗格信息
          const trackedPaneInfo = (window as any).__dragOverPaneInfo__;
          (window as any).__dragOverPaneInfo__ = null;
          
          // 检查是否是内部拖拽（paths 为空但 __internalDragPath__ 存在）
          const internalDragPath = (window as any).__internalDragPath__;
          if (internalDragPath && (!paths || paths.length === 0)) {
            const paneId = trackedPaneInfo?.paneId;
            const paneTabPath = trackedPaneInfo?.paneTabPath;
            
            if (paneId && paneTabPath) {
              const { ensureDocument } = useEditorStore.getState();
              const { setPaneDocument, getDocumentsInPanes, setActivePane } = useSplitStore.getState();
              
              const existingDocs = getDocumentsInPanes(paneTabPath);
              if (!existingDocs.includes(internalDragPath)) {
                const realPath = internalDragPath.replace(/^file:\/\//, '');
                const content = await readTextFile(realPath);
                ensureDocument(internalDragPath, content, false);
                setPaneDocument(paneTabPath, paneId, internalDragPath);
                setActivePane(paneTabPath, paneId);
              }
            }
            (window as any).__internalDragPath__ = null;
            return;
          }
          
          // 外部文件拖拽
          if (!paths || paths.length === 0) return;
          
          const { openDocument, ensureDocument } = useEditorStore.getState();
          const { setPaneDocument, getDocumentsInPanes } = useSplitStore.getState();
          
          // 使用追踪的窗格信息
          const paneId = trackedPaneInfo?.paneId;
          const paneTabPath = trackedPaneInfo?.paneTabPath;
          
          for (const path of paths) {
            let isDir = false;
            try {
              const info = await stat(path);
              isDir = info.isDirectory;
            } catch {
              continue;
            }
            
            if (isDir) {
              const folderName = path.split(/[/\\]/).pop() || path;
              clearAll();
              setRootPath(folderName);
              setRootHandle(path as any);
              const tree = await readDirectoryTauri(path);
              setFileTree(tree);
              return;
            } else if (path.endsWith('.md') || path.endsWith('.markdown') || path.endsWith('.txt')) {
              try {
                const content = await readTextFile(path);
                const docPath = `file://${path}`;
                
                // 检查文件是否已经在当前 tab 的窗格中打开
                const currentTabPath = useEditorStore.getState().activeTabPath;
                if (currentTabPath) {
                  const existingDocsInPanes = getDocumentsInPanes(currentTabPath);
                  if (existingDocsInPanes.includes(docPath)) {
                    // 文件已在窗格中打开，不做任何操作
                    return;
                  }
                }
                
                if (paneId && paneTabPath) {
                  const existingDocs = getDocumentsInPanes(paneTabPath);
                  if (!existingDocs.includes(docPath)) {
                    ensureDocument(docPath, content, false);
                    setPaneDocument(paneTabPath, paneId, docPath);
                    const { setActivePane } = useSplitStore.getState();
                    setActivePane(paneTabPath, paneId);
                  }
                } else {
                  openDocument(docPath, content, false);
                }
              } catch (err) {
                console.error('读取文件失败:', err);
              }
            }
          }
        });
      } catch (err) {
        console.error('设置 Tauri 拖拽监听失败:', err);
      }
    };
    
    setupTauriDragDrop();
    
    return () => {
      if (unlisten) unlisten();
    };
  }, [isReady, readDirectoryTauri, setRootPath, setFileTree, setRootHandle, clearAll]);
  
  // 浏览器拖拽事件处理（Web 版本）
  useEffect(() => {
    if (isTauriCached()) return;
    
    const handleGlobalDrop = async (e: DragEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.closest('.pane-leaf') || target.closest('[data-pane-id]')) {
        return;
      }
      
      e.preventDefault();
      e.stopPropagation();
      
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        const items = Array.from(e.dataTransfer.items);
        for (const item of items) {
          if (item.kind === 'file') {
            const entry = (item as any).webkitGetAsEntry?.();
            if (entry && entry.isDirectory) {
              const dirEntry = entry as FileSystemDirectoryEntry;
              
              try {
                const dirHandle = await (entry as any).getDirectoryHandle?.();
                if (dirHandle) {
                  setRootPath(entry.name);
                  setRootHandle(dirHandle);
                  
                  const readDirectoryRecursive = async (
                    dirHandle: FileSystemDirectoryHandle, 
                    basePath: string
                  ): Promise<any[]> => {
                    const nodes: any[] = [];
                    
                    for await (const entry of (dirHandle as any).values()) {
                      const nodePath = `${basePath}/${entry.name}`;
                      
                      if (entry.kind === 'file' && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
                        nodes.push({
                          name: entry.name,
                          path: nodePath,
                          isDir: false,
                          handle: entry
                        });
                      } else if (entry.kind === 'directory') {
                        nodes.push({
                          name: entry.name,
                          path: nodePath,
                          isDir: true,
                          handle: entry,
                          children: []
                        });
                      }
                    }
                    
                    nodes.sort((a, b) => {
                      if (a.isDir && !b.isDir) return -1;
                      if (!a.isDir && b.isDir) return 1;
                      return a.name.localeCompare(b.name);
                    });
                    
                    return nodes;
                  };
                  
                  const tree = await readDirectoryRecursive(dirHandle, entry.name);
                  setFileTree(tree);
                  return;
                }
              } catch (err) {
                console.log('无法获取目录句柄，使用备用方法');
              }
              
              setRootPath(entry.name);
              
              const readDirectoryFromEntry = async (dirEntry: FileSystemDirectoryEntry, basePath: string): Promise<any[]> => {
                const reader = dirEntry.createReader();
                const entries: any[] = [];
                
                const readAllEntries = async (): Promise<any[]> => {
                  const batch = await new Promise<any[]>((resolve) => {
                    reader.readEntries(resolve, () => resolve([]));
                  });
                  if (batch.length === 0) return [];
                  return [...batch, ...(await readAllEntries())];
                };
                
                const allEntries = await readAllEntries();
                
                for (const ent of allEntries) {
                  if (ent.isFile && (ent.name.endsWith('.md') || ent.name.endsWith('.markdown'))) {
                    const fileEntry = ent as FileSystemFileEntry;
                    const file = await new Promise<File>((resolve) => {
                      fileEntry.file(resolve, () => resolve(null as any));
                    });
                    if (file) {
                      entries.push({
                        name: ent.name,
                        path: `${basePath}/${ent.name}`,
                        isDir: false,
                        handle: file,
                      });
                    }
                  } else if (ent.isDirectory) {
                    entries.push({
                      name: ent.name,
                      path: `${basePath}/${ent.name}`,
                      isDir: true,
                      children: [],
                    });
                  }
                }
                
                entries.sort((a, b) => {
                  if (a.isDir && !b.isDir) return -1;
                  if (!a.isDir && b.isDir) return 1;
                  return a.name.localeCompare(b.name);
                });
                
                return entries;
              };
              
              const tree = await readDirectoryFromEntry(dirEntry, entry.name);
              setFileTree(tree);
              return;
            }
          }
        }
      }
      
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
      const { openDocument } = useEditorStore.getState();
      
      for (const file of Array.from(files)) {
        const filePath = (file as any).path || file.name;
        
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
          const content = await file.text();
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
  }, [readDirectoryTauri, setRootPath, setFileTree, setRootHandle]);

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
            const fileStore = useFileStore.getState();
            const currentRootPath = fileStore.rootPath;
            const dirPath = filePath.replace(/[/\\][^/\\]+$/, '');
            const normalizedDirPath = dirPath.replace(/[/\\]+$/, '');
            if (normalizedDirPath && normalizedDirPath !== currentRootPath) {
              const folderName = normalizedDirPath.split(/[/\\]/).pop() || normalizedDirPath;
              fileStore.clearAll();
              fileStore.setRootPath(folderName);
              fileStore.setRootHandle(normalizedDirPath as any);
              const tree = await readDirectoryTauri(normalizedDirPath);
              fileStore.setFileTree(tree);
            }
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

        const newWindowFile = (window as any).__NEW_WINDOW_FILE__;
        if (newWindowFile && newWindowFile.filePath) {
          const filePath = newWindowFile.filePath;
          const hideSidebar = newWindowFile.hideSidebar;
          delete (window as any).__NEW_WINDOW_FILE__;
          if (hideSidebar) {
            localStorage.setItem('md-editor-sidebar-hidden', 'true');
            window.dispatchEvent(new CustomEvent('sidebar-hide'));
          }
          await openFile(filePath);
        }

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
