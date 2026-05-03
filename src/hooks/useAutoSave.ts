import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore, useSettingsStore, useFileStore } from '../stores';
import { isTauriCached } from '../utils/platform';

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
      // Tauri 环境
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const encoder = new TextEncoder();
      await writeFile(fullPath, encoder.encode(content));
      console.log('[FileSystem] 文件已写入:', fullPath);
      return true;
    } else {
      // 浏览器环境
      const fileHandles = useFileStore.getState().fileHandles;
      const handle = fileHandles.get(fullPath);
      
      if (!handle) {
        console.log('[FileSystem] 没有找到文件handle，无法写入:', fullPath);
        return false;
      }
      
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      console.log('[FileSystem] 文件已写入:', fullPath);
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
function saveToStorage(activeDocPath: string | null, tabs: string[], documents: Record<string, { content: string; isModified: boolean }>): void {
  try {
    const savedDocs: Record<string, { content: string; timestamp: number }> = {};
    for (const [path, doc] of Object.entries(documents)) {
      savedDocs[path] = {
        content: doc.content,
        timestamp: Date.now(),
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
  
  const timeoutRef = useRef<number | null>(null);

  const performSave = useCallback(async () => {
    if (!activeDocPath) return;
    
    // 使用 getState() 避免订阅
    const { documents, tabs } = useEditorStore.getState();
    const doc = documents[activeDocPath];
    if (!doc) return;

    try {
      // 如果是file://开头的文档，尝试写入文件系统
      if (activeDocPath.startsWith('file://')) {
        const written = await writeToFileSystem(activeDocPath, doc.content);
        
        if (written) {
          // 写入成功，清理localStorage中的缓存
          const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
          delete savedDocs[activeDocPath];
          localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedDocs));
          console.log(`[AutoSave] 已写入文件系统并清理缓存: ${activeDocPath}`);
        } else {
          // 写入失败，保存到localStorage作为备份
          saveToStorage(activeDocPath, tabs, documents);
          console.log(`[AutoSave] 写入失败，已保存到缓存: ${activeDocPath}`);
        }
      } else {
        // 新建文档，保存到localStorage
        saveToStorage(activeDocPath, tabs, documents);
      }
      
      saveDocument(activeDocPath);
    } catch (error) {
      console.error('[AutoSave] 保存失败:', error);
    }
  }, [activeDocPath, saveDocument]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = window.setTimeout(() => {
      performSave();
      timeoutRef.current = null;
    }, 1000);
  }, [performSave]);

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
  }, [autoSaveEnabled, saveStatus, scheduleSave]);

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
      const { documents, tabs } = useEditorStore.getState();
      if (activeDocPath && documents[activeDocPath]?.isModified) {
        saveToStorage(activeDocPath, tabs, documents);
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [activeDocPath]);
}

/**
 * 手动保存到文件下载
 */
export function useSaveToFile() {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const saveDocument = useEditorStore((state) => state.saveDocument);

  return useCallback(async () => {
    if (!activeDocPath) return;
    
    // 使用 getState() 避免订阅
    const { documents } = useEditorStore.getState();
    const doc = documents[activeDocPath];
    if (!doc) return;

    const fileName = getFileName(activeDocPath);
    
    // 尝试写入文件系统
    if (activeDocPath.startsWith('file://')) {
      const written = await writeToFileSystem(activeDocPath, doc.content);
      if (written) {
        saveDocument(activeDocPath);
        return;
      }
    }
    
    // 无法写入文件系统，下载文件
    saveFileToLocal(fileName, doc.content);
    
    // 清理localStorage中的副本，避免冲突
    const savedDocs = JSON.parse(localStorage.getItem(STORAGE_KEY_DOCS) || '{}');
    delete savedDocs[activeDocPath];
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(savedDocs));
    
    saveDocument(activeDocPath);
    console.log(`[Save] 已下载文件并清理缓存: ${fileName}`);
  }, [activeDocPath, saveDocument]);
}
