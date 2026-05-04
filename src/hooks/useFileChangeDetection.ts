import { useEffect, useCallback } from 'react';
import { useEditorStore, useFileStore } from '../stores';
import { isTauriCached } from '../utils/platform';
import { getCurrentWindow } from '@tauri-apps/api/window';

/**
 * 文件变化检测 Hook
 * 当窗口获得焦点时，检查当前打开的文件是否有外部修改
 */
export function useFileChangeDetection(): void {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const documents = useEditorStore((state) => state.documents);
  const openDocument = useEditorStore((state) => state.openDocument);

  // 读取文件内容
  const readFileContent = useCallback(async (filePath: string): Promise<string | null> => {
    try {
      if (isTauriCached()) {
        // Tauri 环境
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        const content = await readTextFile(filePath);
        return content;
      } else {
        // 浏览器环境
        const { fileHandles, dirHandles, rootHandle } = useFileStore.getState();
        
        // 尝试多种路径格式查找文件句柄
        let handle = fileHandles.get(filePath);
        
        if (!handle) {
          // 尝试提取文件名查找
          const fileName = filePath.split(/[/\\]/).pop();
          if (fileName) {
            handle = fileHandles.get(fileName);
          }
        }
        
        if (!handle) {
          // 尝试使用相对路径（去掉根路径）
          const parts = filePath.split(/[/\\]/);
          if (parts.length > 1) {
            const relativePath = parts.slice(1).join('/');
            handle = fileHandles.get(relativePath);
          }
        }
        
        if (handle) {
          const file = await handle.getFile();
          const content = await file.text();
          return content;
        }
        
        // 如果还是没有找到，尝试从目录句柄中读取
        const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
        if (lastSlash > 0) {
          const dirPath = filePath.substring(0, lastSlash);
          const fileName = filePath.substring(lastSlash + 1);
          
          let dirHandle = dirHandles.get(dirPath);
          
          // 如果没有找到目录句柄，尝试使用相对路径
          if (!dirHandle) {
            const dirParts = dirPath.split(/[/\\]/);
            if (dirParts.length > 1) {
              const relativeDirPath = dirParts.slice(1).join('/');
              dirHandle = dirHandles.get(relativeDirPath);
            }
          }
          
          if (!dirHandle && dirPath === filePath.split(/[/\\]/)[0]) {
            // 如果是根目录，使用 rootHandle
            dirHandle = rootHandle || undefined;
          }
          
          if (dirHandle) {
            try {
              const fileHandle = await dirHandle.getFileHandle(fileName);
              const file = await fileHandle.getFile();
              const content = await file.text();
              return content;
            } catch (e) {
              // 从目录句柄读取文件失败
            }
          }
        }
        
        return null;
      }
    } catch (err) {
      console.error('[FileChangeDetection] 读取文件失败:', err);
      return null;
    }
  }, []);

  // 检查文件是否有变化
  const checkFileChanges = useCallback(async () => {
    if (!activeDocPath) return;
    
    // 只检查文件（file://开头的路径）
    if (!activeDocPath.startsWith('file://')) return;
    
    const doc = documents[activeDocPath];
    if (!doc || doc.isModified) {
      // 如果文档有未保存的修改，不检查变化
      return;
    }
    
    const filePath = activeDocPath.replace('file://', '');
    const fileContent = await readFileContent(filePath);
    
    if (fileContent === null) return;
    
    // 比较内容
    if (fileContent !== doc.content) {
      // 提示用户
      const shouldReload = confirm(
        `文件 "${filePath.split(/[/\\]/).pop()}" 已在外部被修改。\n\n是否重新加载？\n（未保存的更改将丢失）`
      );
      
      if (shouldReload) {
        // 重新加载文件
        openDocument(activeDocPath, fileContent, false);
      }
    }
  }, [activeDocPath, documents, readFileContent, openDocument]);

  // 监听窗口焦点变化
  useEffect(() => {
    if (isTauriCached()) {
      // Tauri 环境
      const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) {
          checkFileChanges();
        }
      });
      return () => {
        unlisten.then(fn => fn());
      };
    } else {
      // 浏览器环境
      const handleFocus = () => {
        checkFileChanges();
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [checkFileChanges]);
}
