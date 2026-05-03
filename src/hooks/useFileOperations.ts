import { useCallback } from 'react';
import { useFileStore, useEditorStore, TreeNode } from '../stores';
import { isTauriCached } from '../utils/platform';

/**
 * 文件操作 Hook
 * 提供新建文档、打开文件、打开文件夹等操作
 */
export const useFileOperations = () => {
  const { fileTree, rootPath, setRootPath, setFileTree, setFileHandle, setDirHandle, setRootHandle, dirHandles, rootHandle } = useFileStore();
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

  // 递归读取目录（浏览器环境）
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
        const childNodes = await readDirectoryRecursive(entry as FileSystemDirectoryHandle, nodePath);
        nodes.push({
          name: entry.name,
          path: nodePath,
          isDir: true,
          handle: entry,
          children: childNodes
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

  // 从 Tauri 读取目录
  const readDirectoryTauri = useCallback(async (dirPath: string): Promise<TreeNode[]> => {
    const { readDir } = await import('@tauri-apps/plugin-fs');
    const nodes: TreeNode[] = [];
    
    setDirHandle(dirPath, dirPath as any);
    
    try {
      const entries = await readDir(dirPath);
      
      for (const entry of entries) {
        const nodePath = `${dirPath}/${entry.name}`;
        
        if (entry.isFile && (entry.name.endsWith('.md') || entry.name.endsWith('.markdown'))) {
          nodes.push({
            name: entry.name,
            path: nodePath,
            isDir: false,
            handle: undefined
          });
        } else if (entry.isDirectory) {
          const childNodes = await readDirectoryTauri(nodePath);
          nodes.push({
            name: entry.name,
            path: nodePath,
            isDir: true,
            handle: undefined,
            children: childNodes
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
    console.log('[OpenFolder] 开始执行');
    console.log('[OpenFolder] isTauriCached():', isTauriCached());
    
    if (isTauriCached()) {
      // Tauri 环境：使用原生对话框
      console.log('[OpenFolder] 使用 Tauri 对话框');
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      const selected = await open({
        directory: true,
      });
      
      console.log('[OpenFolder] 选择结果:', selected);
      
      if (selected) {
        const folderPath = selected as string;
        const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
        
        setRootPath(folderName);
        setRootHandle(folderPath as any);
        
        const tree = await readDirectoryTauri(folderPath);
        setFileTree(tree);
        
        console.log(`[OpenFolder] 打开文件夹成功: ${folderName}`);
      }
    } else {
      // 浏览器环境：使用 File System Access API
      console.log('[OpenFolder] 使用浏览器 showDirectoryPicker');
      if ('showDirectoryPicker' in window) {
        try {
          const dirHandle = await (window as any).showDirectoryPicker();
          setRootPath(dirHandle.name);
          setRootHandle(dirHandle);
          
          const tree = await readDirectoryRecursive(dirHandle, dirHandle.name);
          setFileTree(tree);
          
          console.log(`[OpenFolder] 打开文件夹: ${dirHandle.name}`);
        } catch (err) {
          console.log('用户取消了选择');
        }
      } else {
        alert('您的浏览器不支持文件夹浏览，请使用"打开文件"功能');
      }
    }
  }, [setRootPath, setFileTree, setRootHandle, readDirectoryRecursive, readDirectoryTauri]);

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
  };
};
