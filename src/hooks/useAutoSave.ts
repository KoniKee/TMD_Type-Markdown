import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore, useSettingsStore, useFileStore } from '../stores';
import { isTauriCached, fileOps } from '../utils/platform';

const STORAGE_KEY_DOCS = 'md-editor-docs';
const STORAGE_KEY_TABS = 'md-editor-tabs';
const STORAGE_KEY_ACTIVE_PATH = 'md-editor-active-path';

/**
 * 保存文件到本地（使用浏览器下载）
 */
export function saveFileToLocal(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从路径提取文件名
 */
export function getFileName(path: string): string {
  let cleanPath = path;
  if (cleanPath.startsWith('file://')) {
    cleanPath = cleanPath.replace('file://', '');
  }
  const parts = cleanPath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || 'untitled.md';
}

/**
 * 写入文件到文件系统
 */
async function writeToFileSystem(docPath: string, content: string): Promise<boolean> {
  // 从docPath中提取完整路径（去掉file://前缀）
  const fullPath = docPath.startsWith('file://') ? docPath.replace('file://', '') : docPath;
  
  try {
    if (isTauriCached()) {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      await writeTextFile(fullPath, content);
      return true;
    } else {
      const fileHandles = useFileStore.getState().fileHandles;
      const handle = fileHandles.get(fullPath);
      
      if (!handle) {
        return false;
      }
      
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    }
  } catch (err) {
    console.error('[FileSystem] 写入文件失败:', err);
    return false;
  }
}

/**
 * 保存所有数据到 localStorage
 */
function saveToStorage(
  activeDocPath: string | null, 
  tabs: string[], 
  documents: Record<string, { content: string; isModified: boolean; isNewFile?: boolean; hasBeenModified?: boolean; filePath?: string }>
): void {
  try {
    const savedDocs: Record<string, { 
      content: string; 
      timestamp: number; 
      isNewFile?: boolean; 
      hasBeenModified?: boolean; 
      filePath?: string;
      isModified?: boolean;
    }> = {};
    
    for (const [path, doc] of Object.entries(documents)) {
      savedDocs[path] = {
        content: doc.content,
        timestamp: Date.now(),
        isNewFile: doc.isNewFile,
        hasBeenModified: doc.hasBeenModified,
        filePath: doc.filePath,
        isModified: doc.isModified,
      };
    }
    
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedDocs));
    localStorage.setItem(STORAGE_KEY_TABS, JSON.stringify(tabs));
    
    if (activeDocPath) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_PATH, activeDocPath);
    }
  } catch (error) {
    console.error('[AutoSave] 保存到 localStorage 失败:', error);
  }
}

/**
 * 自动保存 Hook
 */
export function useAutoSave(): void {
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const saveDocument = useEditorStore((state) => state.saveDocument);
  
  const autoSaveEnabled = useSettingsStore((state) => state.autoSave);
  const autoSaveDelay = useSettingsStore((state) => state.autoSaveDelay);
  
  const timeoutRef = useRef<number | null>(null);

  const performSave = useCallback(async () => {
    if (!activeDocPath) return;
    
    const { documents, tabs, saveDocument, updateFilePath } = useEditorStore.getState();
    const doc = documents[activeDocPath];
    if (!doc) return;

    try {
      if (activeDocPath.startsWith('file://')) {
        // 已保存到文件系统的文档，直接写入
        const written = await writeToFileSystem(activeDocPath, doc.content);
        
        if (written) {
          const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
          delete savedDocs[activeDocPath];
          localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedDocs));
        } else {
          saveToStorage(activeDocPath, tabs, documents);
        }
        
        saveDocument(activeDocPath);
      } else if (doc.isNewFile && doc.hasBeenModified) {
        // 新建文档且有修改，保存到临时目录
        const tempDir = await fileOps.getTempDir();
        
        if (tempDir && isTauriCached()) {
          // 生成临时文件路径
          const separator = tempDir.includes('\\') ? '\\' : '/';
          const fileName = activeDocPath.split('/').pop()?.split('\\').pop() || 'untitled.md';
          const tempFilePath = `${tempDir}${separator}${fileName}`;
          
          // 写入文件
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          await writeTextFile(tempFilePath, doc.content);
          
          // 更新文档路径
          updateFilePath(activeDocPath, tempFilePath);
          
          // 从localStorage中移除
          const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
          delete savedDocs[activeDocPath];
          localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedDocs));
        } else {
          // 无法保存到临时目录，保存到localStorage
          saveToStorage(activeDocPath, tabs, documents);
          saveDocument(activeDocPath);
        }
      } else {
        // 其他情况，保存到localStorage
        saveToStorage(activeDocPath, tabs, documents);
        saveDocument(activeDocPath);
      }
    } catch (error) {
      console.error('[AutoSave] 保存失败:', error);
    }
  }, [activeDocPath]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => {
      performSave();
      timeoutRef.current = null;
    }, autoSaveDelay);
  }, [performSave, autoSaveDelay]);

  useEffect(() => {
    if (!autoSaveEnabled) return;
    if (saveStatus !== 'unsaved') return;
    
    scheduleSave();
    
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [autoSaveEnabled, saveStatus, scheduleSave, autoSaveDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        performSave();
      }
    };
  }, [performSave]);
  
  useEffect(() => {
    const handleBeforeUnload = () => {
      const { documents, tabs, activeDocPath } = useEditorStore.getState();
      // 保存所有文档的状态
      if (Object.keys(documents).length > 0) {
        saveToStorage(activeDocPath, tabs, documents);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeDocPath]);
}

/**
 * 另存为功能 Hook
 */
export function useSaveAsFile() {
  return useCallback(async () => {
    const { activeDocPath, documents, updateFilePath } = useEditorStore.getState();
    if (!activeDocPath) return;
    const doc = documents[activeDocPath];
    if (!doc) return;
    
    const defaultName = doc.content.split('\n')[0].replace(/^#+\s*/, '').trim() || '未命名';
    const fileName = `${defaultName}.md`;
    
    if (isTauriCached()) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        });
        
        if (filePath) {
          const { writeTextFile } = await import('@tauri-apps/plugin-fs');
          await writeTextFile(filePath, doc.content);
          
          updateFilePath(activeDocPath, filePath);
        }
      } catch (e) {
        console.error('Save as failed:', e);
      }
    } else {
      try {
        if ('showSaveFilePicker' in window) {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: fileName,
            types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }]
          });
          
          const writable = await handle.createWritable();
          await writable.write(doc.content);
          await writable.close();
          
          const fileHandles = useFileStore.getState().fileHandles;
          fileHandles.set(handle.name, handle);
          
          updateFilePath(activeDocPath, handle.name);
        } else {
          saveFileToLocal(fileName, doc.content);
          const { saveDocument } = useEditorStore.getState();
          saveDocument(activeDocPath);
        }
      } catch (e) {
        console.error('Save as failed:', e);
      }
    }
  }, []);
}

/**
 * 手动保存到文件下载
 */
export function useSaveToFile() {
  const saveAsFile = useSaveAsFile();
  
  return useCallback(async () => {
    const { activeDocPath, documents } = useEditorStore.getState();
    if (!activeDocPath) return;
    const doc = documents[activeDocPath];
    if (!doc) return;
    
    // 智能判断：新建文档或没有filePath时，执行另存为
    if (doc.isNewFile || !doc.filePath) {
      await saveAsFile();
      return;
    }
    
    // 已保存文档，保存到原路径
    const written = await writeToFileSystem(doc.filePath, doc.content);
    if (written) {
      const { saveDocument } = useEditorStore.getState();
      saveDocument(activeDocPath);
      return;
    }
    
    // 无法写入文件系统，下载文件
    const fileName = getFileName(activeDocPath);
    saveFileToLocal(fileName, doc.content);
    const { saveDocument } = useEditorStore.getState();
    saveDocument(activeDocPath);
  }, [saveAsFile]);
}
