import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { useTheme, useFileOperations } from './hooks';
import { waitForTauri, isTauriCached } from './utils/platform';
import { useEditorStore, useUpdateStore, useSettingsStore, useFileStore } from './stores';

function App() {
  const [isReady, setIsReady] = useState(false);
  const checkForUpdate = useUpdateStore((state) => state.checkForUpdate);
  const { readDirectoryTauri } = useFileOperations();
  const { setRootPath, setFileTree, setRootHandle } = useFileStore();

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
              
              if (isTauriCached()) {
                const allFiles = e.dataTransfer.files;
                if (allFiles && allFiles.length > 0) {
                  let folderPath = '';
                  for (let i = 0; i < allFiles.length; i++) {
                    const fp = (allFiles[i] as any).path;
                    if (fp) {
                      const sep = fp.includes('\\') ? '\\' : '/';
                      const idx = fp.lastIndexOf(`${sep}${entry.name}${sep}`);
                      if (idx >= 0) {
                        folderPath = fp.substring(0, idx + entry.name.length + 2);
                        break;
                      }
                    }
                  }
                  if (!folderPath && (allFiles[0] as any).path) {
                    const firstFilePath = (allFiles[0] as any).path;
                    const lastSlash = Math.max(firstFilePath.lastIndexOf('/'), firstFilePath.lastIndexOf('\\'));
                    folderPath = lastSlash > 0 ? firstFilePath.substring(0, lastSlash) : firstFilePath;
                  }
                  
                  if (folderPath) {
                    setRootPath(entry.name);
                    setRootHandle(folderPath as any);
                    const tree = await readDirectoryTauri(folderPath);
                    setFileTree(tree);
                    return;
                  }
                }
              }
              
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
