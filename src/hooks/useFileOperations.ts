import { useCallback } from 'react';
import { useFileStore, useEditorStore, TreeNode } from '../stores';
import { isTauriCached } from '../utils/platform';

/**
 * 文件操作 Hook
 * 提供新建文档、打开文件、打开文件夹等操作
 */
export const useFileOperations = () => {
  const { fileTree, rootPath, setRootPath, setFileTree, setFileHandle, setDirHandle, setRootHandle, dirHandles, rootHandle, clearAll } = useFileStore();
  const { openDocument } = useEditorStore();

  // 新建文档
  const handleNewFile = useCallback(() => {
    const fileName = `新建文档-${Date.now()}.md`;
    const content = `# 新建文档\n\n在这里开始写作...\n`;
    openDocument(fileName, content, true);
  }, [openDocument]);

  // 打开本地文件
  const handleOpenFile = useCallback(async () => {
    if (isTauriCached()) {
      // Tauri 环境：使用原生对话框
      console.log('[OpenFile] 使用 Tauri 对话框');
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }],
      });
      
      if (selected) {
        const files = Array.isArray(selected) ? selected : [selected];
        for (const filePath of files) {
          try {
            const content = await readTextFile(filePath as string);
            const fileName = (filePath as string).split(/[/\\]/).pop() || 'untitled.md';
            openDocument(`file://${filePath}`, content, false);
            console.log(`[OpenFile] 加载: ${fileName}`);
          } catch (err) {
            console.error('读取文件失败:', err);
          }
        }
      }
    } else {
      // 浏览器环境：使用 input 元素
      console.log('[OpenFile] 使用浏览器 input');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.txt';
      input.multiple = true;
      
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files) return;
        
        for (const file of files) {
          const content = await file.text();
          const fileName = file.name;
          const docPath = `file://${fileName}`;
          openDocument(docPath, content, false);
          console.log(`[OpenFile] 加载: ${fileName}`);
        }
      };
      
      input.click();
    }
  }, [openDocument]);

  // 读取目录（浏览器环境，只读取一级，不递归）
  const readDirectoryRecursive = useCallback(async (dirHandle: FileSystemDirectoryHandle, basePath: string): Promise<TreeNode[]> => {
    const nodes: TreeNode[] = [];
    
    setDirHandle(basePath, dirHandle);
    
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
        // 保存子目录的 handle，用于延迟加载
        setDirHandle(nodePath, entry as FileSystemDirectoryHandle);
        // 不递归读取子目录，延迟加载
        nodes.push({
          name: entry.name,
          path: nodePath,
          isDir: true,
          handle: entry,
          children: [] // 空数组，表示未加载
        });
      }
    }
    
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return nodes;
  }, [setDirHandle]);

  // 从 Tauri 读取目录（只读取一级，不递归）
  const readDirectoryTauri = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const nodes: TreeNode[] = [];
    
    setDirHandle(dirPath, dirPath as any);
    
    try {
      const entries = await readDir(dirPath);
      
      for (const entry of entries) {
        const nodePath = dirPath.endsWith('\\') || dirPath.endsWith('/') 
          ? `${dirPath}${entry.name}` 
          : `${dirPath}\\${entry.name}`;
        
        if (entry.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          nodes.push({
            name: entry.name,
            path: nodePath,
            isDir: false,
            handle: undefined
          });
        } else if (entry.isDirectory) {
          // 不递归读取子目录，延迟加载
          nodes.push({
            name: entry.name,
            path: nodePath,
            isDir: true,
            handle: undefined,
            children: [] // 空数组，表示未加载
          });
        }
      }
    } catch (err) {
      console.error('读取目录失败:', err);
    }
    
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return nodes;
  }, [setDirHandle]);

  // 打开文件夹
  const handleOpenFolder = useCallback(async () => {
    if (isTauriCached()) {
      // Tauri 环境：使用原生对话框
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      const selected = await open({
        directory: true,
      });
      
      if (selected) {
        const folderPath = selected as string;
        const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
        
        // 清理旧状态
        clearAll();
        
        // 设置新状态
        setRootPath(folderName);
        setRootHandle(folderPath as any);
        
        const tree = await readDirectoryTauri(folderPath);
        setFileTree(tree);
      }
    } else {
      // 浏览器环境：使用 File System Access API
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker();
          setRootPath(dirHandle.name);
          setRootHandle(dirHandle);
          
          const tree = await readDirectoryRecursive(dirHandle, dirHandle.name);
          setFileTree(tree);
        } catch (err) {
          // 用户取消了选择
        }
      } else {
        alert('您的浏览器不支持文件夹浏览，请使用"打开文件"功能');
      }
    }
  }, [setRootPath, setFileTree, setRootHandle, readDirectoryRecursive, readDirectoryTauri, clearAll]);

  return {
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    readDirectoryRecursive,
    readDirectoryTauri,
    fileTree,
    rootPath,
    rootHandle,
    dirHandles,
    setFileTree,
    setFileHandle,
    setDirHandle,
    setRootHandle,
    setRootPath,
    clearAll,
  };
};
