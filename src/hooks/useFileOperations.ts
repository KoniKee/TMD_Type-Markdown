import { useCallback } from 'react';
import { useFileStore, useEditorStore, TreeNode } from '../stores';

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
    openDocument(fileName, content, true); // true表示是新建的未保存文档
  }, [openDocument]);

  // 打开本地文件
  const handleOpenFile = useCallback(async () => {
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
  }, [openDocument]);

  // 递归读取目录
  const readDirectoryRecursive = useCallback(async (dirHandle: FileSystemDirectoryHandle, basePath: string): Promise<TreeNode[]> => {
    const nodes: TreeNode[] = [];
    
    // 保存目录句柄
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
    
    // 排序：目录在前，文件在后
    nodes.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return nodes;
  }, [setDirHandle]);

  // 从File System Access API打开文件夹（如果支持）
  const handleOpenFolder = useCallback(async () => {
    // 检查是否支持File System Access API
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        setRootPath(dirHandle.name);
        setRootHandle(dirHandle);
        
        // 递归读取目录内容
        const tree = await readDirectoryRecursive(dirHandle, dirHandle.name);
        setFileTree(tree);
        
        console.log(`[OpenFolder] 打开文件夹: ${dirHandle.name}`);
      } catch (err) {
        console.log('用户取消了选择');
      }
    } else {
      alert('您的浏览器不支持文件夹浏览，请使用"打开文件"功能');
    }
  }, [setRootPath, setFileTree, setRootHandle, readDirectoryRecursive]);

  return {
    handleNewFile,
    handleOpenFile,
    handleOpenFolder,
    readDirectoryRecursive,
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
