import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFileStore, useEditorStore, useSplitStore, TreeNode } from '../../stores';
import { useFileOperations } from '../../hooks/useFileOperations';
import { isTauriCached } from '../../utils/platform';
import { useRecentFilesStore, formatTime } from '../../stores/recentFilesStore';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  Pencil,
  MoreHorizontal,
  X,
  RefreshCw,
  Trash2,
  LucideIcon,
  FilePlus,
  Clock,
  Pin,
  PinOff,
  ExternalLink,
  Columns
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
  recentFile: { path: string; name: string } | null;
}

interface RenameState {
  path: string;
  oldName: string;
  isDir: boolean;
}

interface NewFileState {
  parentPath: string;
}

interface NewDirState {
  parentPath: string;
}

interface DeleteState {
  path: string;
  name: string;
  isDir: boolean;
}

export const Sidebar: React.FC = () => {
  const { fileTree, rootPath, setFileTree, setFileHandle, setDirHandle, rootHandle, dirHandles } = useFileStore();
  const { openDocument, renameDocument, documents, activeTabPath, ensureDocument } = useEditorStore();
  const { readDirectoryRecursive, readDirectoryTauri, handleNewFile, handleOpenFile, handleOpenFolder } = useFileOperations();
  const { recentFiles, addFile, removeFile, clearAll, pinFile, unpinFile } = useRecentFilesStore();
  const getPaneCount = useSplitStore((state) => state.getPaneCount);
  const getCurrentState = useSplitStore((state) => state.getCurrentState);
  const setPaneDocument = useSplitStore((state) => state.setPaneDocument);
  const setActivePane = useSplitStore((state) => state.setActivePane);
  const getDocumentsInPanes = useSplitStore((state) => state.getDocumentsInPanes);
  
  const hasSplitPanes = activeTabPath ? getPaneCount(activeTabPath) > 1 : false;

  // 视图切换：'files' | 'recent'
  const [viewMode, setViewMode] = useState<'files' | 'recent'>('files');

  // 获取 Tauri 环境下的完整根路径
  const getFullRootPath = useCallback(() => {
    if (isTauriCached() && rootHandle) {
      return rootHandle as unknown as string;
    }
    return rootPath;
  }, [rootHandle, rootPath]);

  // 刷新文件树
  const refreshTree = useCallback(async () => {
    const fullRoot = getFullRootPath();
    if (!fullRoot) return;
    
    try {
      if (isTauriCached()) {
        const tree = await readDirectoryTauri(fullRoot);
        setFileTree(tree);
      } else if (rootHandle) {
        const tree = await readDirectoryRecursive(rootHandle, rootPath!);
        setFileTree(tree);
      }
    } catch (err) {
      console.error('[RefreshTree] 刷新失败:', err);
    }
  }, [getFullRootPath, readDirectoryTauri, readDirectoryRecursive, rootHandle, rootPath, setFileTree]);

  // 将相对路径转换为绝对路径（Tauri 环境）
  const toAbsolutePath = useCallback((relativePath: string) => {
    if (isTauriCached()) {
      // 如果已经是绝对路径（Windows 包含盘符，Unix 以 / 开头），直接返回
      if (relativePath.includes(':') || relativePath.startsWith('/')) {
        return relativePath;
      }
      const fullRoot = getFullRootPath();
      if (!fullRoot) {
        return relativePath;
      }
      return `${fullRoot}\\${relativePath}`;
    }
    return relativePath;
  }, [getFullRootPath]);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null,
    recentFile: null
  });
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const [newFileState, setNewFileState] = useState<NewFileState | null>(null);
  const [newDirState, setNewDirState] = useState<NewDirState | null>(null);
  const [deleteState, setDeleteState] = useState<DeleteState | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newDirInputRef = useRef<HTMLInputElement>(null);

  // 窗口获得焦点时刷新文件树
  useEffect(() => {
    if (isTauriCached()) {
      const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused && rootPath) {
          refreshTree();
        }
      });
      return () => {
        unlisten.then(fn => fn());
      };
    } else {
      const handleFocus = () => {
        if (rootPath) {
          refreshTree();
        }
      };
      window.addEventListener('focus', handleFocus);
      return () => window.removeEventListener('focus', handleFocus);
    }
  }, [rootPath, refreshTree]);

  // 点击文件打开
  const handleFileClick = async (node: TreeNode) => {
    // 设置选中的目录（用于新建文件/文件夹的基准目录）
    if (node.isDir) {
      setSelectedDir(node.path);
    } else {
      const lastSlash = Math.max(node.path.lastIndexOf('/'), node.path.lastIndexOf('\\'));
      const parentPath = lastSlash > 0 ? node.path.substring(0, lastSlash) : '';
      setSelectedDir(parentPath || rootPath || '');
    }
    
    if (!node.isDir) {
      const docPath = `file://${node.path}`;

      try {
        if (isTauriCached()) {
          // Tauri 环境
          const { readTextFile } = await import('@tauri-apps/plugin-fs');
          const content = await readTextFile(node.path);
          openDocument(docPath, content, false);
        } else {
          // 浏览器环境
          if (node.handle && node.handle.kind === 'file') {
            setFileHandle(node.path, node.handle);
            const file = await node.handle.getFile();
            const content = await file.text();
            openDocument(docPath, content, false);
          }
        }
      } catch (err) {
        console.error('读取文件失败:', err);
      }
    }
  };

  const openFileInPane = async (node: TreeNode) => {
    if (!activeTabPath) return;
    
    const splitState = getCurrentState(activeTabPath);
    if (!splitState) return;
    
    const docPath = `file://${node.path}`;
    
    const existingDocs = getDocumentsInPanes(activeTabPath);
    if (existingDocs.includes(docPath)) {
      return;
    }
    
    try {
      let content: string;
      if (isTauriCached()) {
        const { readTextFile } = await import('@tauri-apps/plugin-fs');
        content = await readTextFile(node.path);
      } else {
        if (node.handle && node.handle.kind === 'file') {
          const file = await node.handle.getFile();
          content = await file.text();
        } else {
          return;
        }
      }
      
      ensureDocument(docPath, content, false);
      setPaneDocument(activeTabPath, splitState.activePaneId, docPath);
      setActivePane(activeTabPath, splitState.activePaneId);
      addFile(docPath, node.name);
    } catch (err) {
      console.error('在窗格中打开文件失败:', err);
    }
  };

  const toggleDir = async (path: string, node?: TreeNode) => {
    const newExpanded = new Set(expandedDirs);
    
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
      setExpandedDirs(newExpanded);
    } else {
      newExpanded.add(path);
      setExpandedDirs(newExpanded);
      
      // 检查是否需要加载子目录（延迟加载）
      if (node && node.isDir && (!node.children || node.children.length === 0)) {
        try {
          let children: TreeNode[];
          
          if (isTauriCached()) {
            children = await readDirectoryTauri(path);
          } else {
            const dirHandle = dirHandles.get(path);
            if (dirHandle) {
              children = await readDirectoryRecursive(dirHandle, path);
            } else {
              children = [];
            }
          }
          
          // 更新 fileTree 中对应节点的 children
          const updateNodeChildren = (nodes: TreeNode[], targetPath: string, newChildren: TreeNode[]): TreeNode[] => {
            return nodes.map(n => {
              if (n.path === targetPath) {
                return { ...n, children: newChildren };
              }
              if (n.children) {
                return { ...n, children: updateNodeChildren(n.children, targetPath, newChildren) };
              }
              return n;
            });
          };
          
          setFileTree(updateNodeChildren(fileTree, path, children));
        } catch (err) {
          console.error('[toggleDir] 加载子目录失败:', err);
        }
      }
    }
  };

  // 右键菜单
  const handleContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node,
      recentFile: null
    });
  };

  const handleRecentFileContextMenu = (e: React.MouseEvent, file: { path: string; name: string }) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node: null,
      recentFile: file
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null, recentFile: null });
  };

  // 开始重命名
  const startRename = () => {
    if (contextMenu.node) {
      setRenameState({
        path: contextMenu.node.path,
        oldName: contextMenu.node.name,
        isDir: contextMenu.node.isDir
      });
      closeContextMenu();
    }
  };

  // 开始创建新文件
  const startNewFile = () => {
    if (contextMenu.node) {
      const lastSlash = Math.max(contextMenu.node.path.lastIndexOf('/'), contextMenu.node.path.lastIndexOf('\\'));
      const parentPath = contextMenu.node.isDir
        ? contextMenu.node.path
        : contextMenu.node.path.substring(0, lastSlash);

      setNewFileState({ parentPath });
      closeContextMenu();
    }
  };

  // 完成创建新文件
  const finishNewFile = async (fileName: string) => {
    if (!newFileState || !fileName) {
      setNewFileState(null);
      return;
    }

    const { parentPath } = newFileState;
    const finalName = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
    const defaultContent = `# ${finalName.replace('.md', '')}\n\n在这里开始写作...\n`;

    try {
      if (isTauriCached()) {
        const absoluteParentPath = toAbsolutePath(parentPath);
        const filePath = `${absoluteParentPath}\\${finalName}`;
        
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(filePath, defaultContent);
        
        const fullRoot = getFullRootPath();
        if (fullRoot) {
          const tree = await readDirectoryTauri(fullRoot);
          setFileTree(tree);
        }
        
        openDocument(`file://${filePath}`, defaultContent, false);
      } else {
        // 浏览器环境
        const dirHandle = dirHandles.get(parentPath) || rootHandle;
        if (!dirHandle) {
          alert('无法获取目录句柄，请重新打开文件夹');
          setNewFileState(null);
          return;
        }

        const fileHandle = await dirHandle.getFileHandle(finalName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(defaultContent);
        await writable.close();

        setFileHandle(finalName, fileHandle);

        const tree = await readDirectoryRecursive(rootHandle!, rootPath!);
        setFileTree(tree);

        const docPath = `file://${parentPath}/${finalName}`;
        const file = await fileHandle.getFile();
        const content = await file.text();
        openDocument(docPath, content, false);
      }
    } catch (err) {
      console.error('[NewFile] 创建文件失败:', err);
      alert('创建文件失败: ' + (err instanceof Error ? err.message : String(err)));
    }

    setNewFileState(null);
  };

  // 取消创建新文件
  const cancelNewFile = () => {
    setNewFileState(null);
  };

  // 开始创建新目录
  const startNewDir = () => {
    if (contextMenu.node) {
      const lastSlash = Math.max(contextMenu.node.path.lastIndexOf('/'), contextMenu.node.path.lastIndexOf('\\'));
      const parentPath = contextMenu.node.isDir
        ? contextMenu.node.path
        : contextMenu.node.path.substring(0, lastSlash);

      setNewDirState({ parentPath });
      closeContextMenu();
    }
  };

  // 完成创建新目录
  const finishNewDir = async (dirName: string) => {
    if (!newDirState || !dirName) {
      setNewDirState(null);
      return;
    }

    const { parentPath } = newDirState;

    try {
      if (isTauriCached()) {
        const absoluteParentPath = toAbsolutePath(parentPath);
        const dirPath = `${absoluteParentPath}\\${dirName}`;
        
        const { mkdir } = await import('@tauri-apps/plugin-fs');
        await mkdir(dirPath);
        
        const fullRoot = getFullRootPath();
        if (fullRoot) {
          const tree = await readDirectoryTauri(fullRoot);
          setFileTree(tree);
        }
      } else {
        // 浏览器环境
        const dirHandle = dirHandles.get(parentPath) || rootHandle;
        if (!dirHandle) {
          alert('无法获取目录句柄，请重新打开文件夹');
          setNewDirState(null);
          return;
        }

        const newDirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
        setDirHandle(`${parentPath}/${dirName}`, newDirHandle);

        const tree = await readDirectoryRecursive(rootHandle!, rootPath!);
        setFileTree(tree);
      }

      setExpandedDirs(prev => {
        const newSet = new Set(prev);
        newSet.add(parentPath);
        return newSet;
      });
    } catch (err) {
      console.error('[NewDir] 创建目录失败:', err);
      alert('创建目录失败: ' + (err instanceof Error ? err.message : String(err)));
    }

    setNewDirState(null);
  };

  // 取消创建新目录
  const cancelNewDir = () => {
    setNewDirState(null);
  };

  // 完成重命名
  const finishRename = async (newName: string) => {
    if (!renameState) return;

    const { path, oldName, isDir } = renameState;

    if (newName && newName !== oldName) {
      // 文件夹不加 .md 后缀
      const finalName = isDir ? newName : (newName.endsWith('.md') ? newName : `${newName}.md`);
      const oldDocPath = `file://${path}`;
      const isNewFile = documents[oldDocPath]?.isNewFile;

      if (isNewFile) {
        const newDocPath = `file://${finalName}`;
        renameDocument(oldDocPath, newDocPath);
      } else {
        const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
        const parentPath = path.substring(0, lastSlash);
        const pathSep = isTauriCached() ? '\\' : '/';
        const oldEntryPath = `${parentPath}${pathSep}${oldName}`;
        const newEntryPath = `${parentPath}${pathSep}${finalName}`;

        try {
          if (isTauriCached()) {
            const { rename } = await import('@tauri-apps/plugin-fs');
            await rename(oldEntryPath, newEntryPath);

            const fullRoot = getFullRootPath();
            if (fullRoot) {
              const tree = await readDirectoryTauri(fullRoot);
              setFileTree(tree);
            }
          } else {
            // 浏览器环境
            const dirHandle = dirHandles.get(parentPath) || rootHandle;
            if (!dirHandle) {
              alert('无法获取目录句柄，请重新打开文件夹');
              setRenameState(null);
              return;
            }

            if (isDir) {
              // 重命名文件夹
              const oldDirHandle = await dirHandle.getDirectoryHandle(oldName);
              const newDirHandle = await dirHandle.getDirectoryHandle(finalName, { create: true });
              
              // 递归复制所有内容
              await copyDirectoryContents(oldDirHandle, newDirHandle);
              
              // 删除旧目录
              await dirHandle.removeEntry(oldName, { recursive: true });
              
              setDirHandle(newEntryPath, newDirHandle);
            } else {
              // 重命名文件
              const oldFileHandle = await dirHandle.getFileHandle(oldName);
              const file = await oldFileHandle.getFile();
              const content = await file.text();

              const newFileHandle = await dirHandle.getFileHandle(finalName, { create: true });
              const writable = await newFileHandle.createWritable();
              await writable.write(content);
              await writable.close();

              if ('removeEntry' in dirHandle) {
                await dirHandle.removeEntry(oldName);
              }

              setFileHandle(newEntryPath, newFileHandle);
            }

            if (rootHandle && rootPath) {
              const tree = await readDirectoryRecursive(rootHandle, rootPath);
              setFileTree(tree);
            }
          }
        } catch (err) {
          console.error('[Rename] 重命名失败:', err);
          alert('重命名失败: ' + (err instanceof Error ? err.message : String(err)));
        }
      }
    }

    setRenameState(null);
  };

  // 递归复制目录内容
  const copyDirectoryContents = async (sourceDir: FileSystemDirectoryHandle, targetDir: FileSystemDirectoryHandle) => {
    // @ts-ignore - FileSystemDirectoryHandle.values() is part of File System Access API
    for await (const entry of sourceDir.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const content = await file.text();
        const newFileHandle = await targetDir.getFileHandle(entry.name, { create: true });
        const writable = await newFileHandle.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        const newSubDir = await targetDir.getDirectoryHandle(entry.name, { create: true });
        await copyDirectoryContents(entry as FileSystemDirectoryHandle, newSubDir);
      }
    }
  };

  // 取消重命名
  const cancelRename = () => {
    setRenameState(null);
  };

  // 开始删除
  const startDelete = () => {
    if (contextMenu.node) {
      setDeleteState({
        path: contextMenu.node.path,
        name: contextMenu.node.name,
        isDir: contextMenu.node.isDir
      });
      closeContextMenu();
    }
  };

  // 完成删除
  const finishDelete = async () => {
    if (!deleteState) return;

    const { path, name, isDir } = deleteState;

    try {
      const absolutePath = toAbsolutePath(path);
      
      const { Command } = await import('@tauri-apps/plugin-shell');
      
      // 检测操作系统
      const platform = navigator.platform.toLowerCase();
      
      if (platform.includes('win')) {
        // Windows: 使用 PowerShell 移动到回收站
        const deleteMethod = isDir ? 'DeleteDirectory' : 'DeleteFile';
        const command = Command.create('powershell', [
          '-Command',
          `Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::${deleteMethod}('${absolutePath}', 'OnlyErrorDialogs', 'SendToRecycleBin')`
        ]);
        await command.execute();
      } else if (platform.includes('mac')) {
        // macOS: 使用 osascript 移动到回收站
        const command = Command.create('osascript', [
          '-e',
          `tell application "Finder" to delete POSIX file "${absolutePath}"`
        ]);
        await command.execute();
      } else {
        // Linux: 使用 gio trash（如果可用）或 kioclient（KDE）
        try {
          const command = Command.create('gio', ['trash', absolutePath]);
          await command.execute();
        } catch {
          // 如果 gio 不可用，尝试 kioclient
          const command = Command.create('kioclient', ['move', absolutePath, 'trash:/']);
          await command.execute();
        }
      }
      
      const fullRoot = getFullRootPath();
      if (fullRoot) {
        const tree = await readDirectoryTauri(fullRoot);
        setFileTree(tree);
      }
    } catch (err) {
      console.error('[Delete] 删除失败:', err);
      alert('删除失败: ' + (err instanceof Error ? err.message : String(err)));
    }

    setDeleteState(null);
  };

  // 取消删除
  const cancelDelete = () => {
    setDeleteState(null);
  };

  // 点击其他地方关闭菜单
  useEffect(() => {
    const handleClick = () => closeContextMenu();
    if (contextMenu.visible) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.visible]);

  // 重命名输入框自动聚焦
  useEffect(() => {
    if (renameState && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameState]);

  // 新建目录输入框自动聚焦
  useEffect(() => {
    if (newDirState && newDirInputRef.current) {
      newDirInputRef.current.focus();
      newDirInputRef.current.select();
    }
  }, [newDirState]);

  // 获取文件图标
  const getFileIcon = (name: string, isDir: boolean, isExpanded: boolean) => {
    if (isDir) {
      return isExpanded ? FolderOpen : Folder;
    }

    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'md':
      case 'markdown':
        return FileText;
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return FileCode;
      default:
        return File;
    }
  };

  // 渲染文件树
  const renderTree = (nodes: TreeNode[], depth = 0) => {
    return nodes.map((node, index) => {
      const isExpanded = expandedDirs.has(node.path);
      const isHovered = hoveredPath === node.path;
      const Icon = getFileIcon(node.name, node.isDir, isExpanded);
      const isLast = index === nodes.length - 1;

      return (
        <div key={node.path} className="relative">
          {/* 层级连接线 */}
          {depth > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--sidebar-border)] opacity-40"
              style={{ left: `${depth * 16 + 11}px` }}
            />
          )}

          <div
            className={`
              group flex items-center py-1.5 cursor-pointer
              transition-all duration-[var(--transition-fast)]
              rounded-md mx-1
              ${isHovered ? 'bg-[var(--sidebar-hover)]' : ''}
              ${renameState?.path === node.path ? 'bg-[var(--sidebar-hover)]' : ''}
            `}
            style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: '8px' }}
            draggable={!node.isDir}
            onDragStart={(e) => {
              if (node.isDir) return;
              
              if (node.handle && node.handle.kind === 'file') {
                setFileHandle(node.path, node.handle as FileSystemFileHandle);
              }
              
              const docPath = `file://${node.path}`;
              e.dataTransfer.setData('application/x-file-path', docPath);
              e.dataTransfer.setData('text/plain', docPath);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => {
              if (node.isDir) {
                setSelectedDir(node.path);
                toggleDir(node.path, node);
              } else {
                handleFileClick(node);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, node)}
            onMouseEnter={() => setHoveredPath(node.path)}
            onMouseLeave={() => setHoveredPath(null)}
          >
            {/* 箭头区域 - 固定宽度 */}
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-[var(--sidebar-text-muted)]">
              {node.isDir ? (
                isExpanded ? (
                  <ChevronDown size={14} className="transition-transform" />
                ) : (
                  <ChevronRight size={14} className="transition-transform" />
                )
              ) : null}
            </div>

            {/* 图标区域 - 固定宽度 */}
            <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mr-2">
              <Icon
                size={16}
                className={`
                  transition-colors
                  ${node.isDir
                    ? 'text-[var(--accent-400)]'
                    : 'text-[var(--editor-text-secondary)]'
                  }
                `}
              />
            </div>

            {/* 文件名或重命名输入框 */}
            {renameState?.path === node.path ? (
              <input
                ref={renameInputRef}
                type="text"
                className="flex-1 bg-[var(--editor-bg)] border border-[var(--accent-500)] rounded px-2 py-0.5 text-sm outline-none min-w-0"
                defaultValue={node.name}
                autoFocus
                onBlur={(e) => finishRename(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    finishRename(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    cancelRename();
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate text-sm text-[var(--sidebar-text)]">
                {node.name}
              </span>
            )}

            {/* 悬停时的操作按钮 */}
            {isHovered && !renameState && (
              <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="p-1 rounded hover:bg-[var(--sidebar-active)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e as unknown as React.MouseEvent, node);
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            )}
          </div>

          {/* 子节点 */}
          {node.isDir && isExpanded && node.children && (
            <div className="relative">
              {renderTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className="h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] flex flex-col select-none"
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--sidebar-border)]">
      {/* Tab切换 - 仅桌面版显示最近列表 */}
      <div className="flex items-center gap-1">
        <button
          className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
            viewMode === 'files' 
              ? 'bg-[var(--accent-500)] text-white' 
              : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
          }`}
          onClick={() => setViewMode('files')}
        >
          文件
        </button>
        {isTauriCached() && (
          <button
            className={`px-2 py-1 text-xs font-semibold rounded transition-colors ${
              viewMode === 'recent' 
                ? 'bg-[var(--accent-500)] text-white' 
                : 'text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)]'
            }`}
            onClick={() => setViewMode('recent')}
          >
            最近
          </button>
        )}
      </div>
        {viewMode === 'files' && (
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
              onClick={handleNewFile}
              title="新建文档"
            >
              <FilePlus size={14} />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
              onClick={() => handleOpenFile()}
              title="打开文件"
            >
              <FileText size={14} />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
              onClick={handleOpenFolder}
              title="打开文件夹"
            >
              <FolderOpen size={14} />
            </button>
            {rootHandle && (
              <button
                className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
                onClick={refreshTree}
                title="刷新目录树"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        )}
        {viewMode === 'recent' && recentFiles.length > 0 && (
          <button
            className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-red-500 transition-colors"
            onClick={() => {
              if (confirm('确定要清空所有最近打开记录吗？')) {
                clearAll();
              }
            }}
            title="清空全部"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* 文件树 / 最近文件列表 */}
      <div className="flex-1 overflow-auto py-2">
        {viewMode === 'files' ? (
          // 文件视图
          rootPath ? (
            <div className="px-1">
              {/* 根文件夹 */}
              <div key={rootPath}>
                <div
                  className={`
                    group flex items-center py-1.5 px-2 cursor-pointer
                    transition-all duration-[var(--transition-fast)]
                    rounded-md
                    ${hoveredPath === rootPath ? 'bg-[var(--sidebar-hover)]' : ''}
                  `}
                  onClick={() => toggleDir(rootPath)}
                  onContextMenu={(e) => handleContextMenu(e, {
                    name: rootPath,
                    path: getFullRootPath() || rootPath,  // 使用完整路径
                    isDir: true,
                    handle: rootHandle || undefined
                  })}
                  onMouseEnter={() => setHoveredPath(rootPath)}
                  onMouseLeave={() => setHoveredPath(null)}
                >
                  <span className="w-4 h-4 flex items-center justify-center mr-1 text-[var(--sidebar-text-muted)]">
                    {expandedDirs.has(rootPath) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </span>
                  {expandedDirs.has(rootPath) ? (
                    <FolderOpen size={16} className="mr-2 text-[var(--accent-400)]" />
                  ) : (
                    <Folder size={16} className="mr-2 text-[var(--accent-400)]" />
                  )}
                  <span className="truncate text-sm font-medium text-[var(--sidebar-text)]">
                    {rootPath}
                  </span>
                </div>

                {/* 根文件夹内容 */}
                {expandedDirs.has(rootPath) && (
                  <div className="mt-0.5">
                    {renderTree(fileTree, 1)}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
              <FolderOpen size={32} className="text-[var(--sidebar-text-muted)] mb-2 opacity-50" />
              <p className="text-sm text-[var(--sidebar-text-muted)]">
                打开文件夹以查看文件
              </p>
            </div>
          )
        ) : (
          // 最近文件视图
          recentFiles.length > 0 ? (
            <div className="px-1">
              {recentFiles.map((file) => (
                <div
                  key={file.path}
                  className="group flex items-center py-1.5 px-2 cursor-pointer rounded-md hover:bg-[var(--sidebar-hover)] transition-all"
                  onMouseEnter={() => setHoveredPath(file.path)}
                  onMouseLeave={() => setHoveredPath(null)}
                  onContextMenu={(e) => handleRecentFileContextMenu(e, file)}
                  onClick={async () => {
                    try {
                      if (isTauriCached()) {
                        const { readTextFile } = await import('@tauri-apps/plugin-fs');
                        // Tauri版本：去掉file://前缀
                        const realPath = file.path.replace(/^file:\/\//, '');
                        const content = await readTextFile(realPath);
                        openDocument(file.path, content, false);
                        addFile(file.path, file.name);
                      } else {
                        // 浏览器环境：尝试从fileStore获取文件句柄
                        const { getFileHandle } = useFileStore.getState();
                        
                        // 去掉 file:// 前缀（存储句柄时用的是原始路径）
                        const realPath = file.path.replace(/^file:\/\//, '');
                        
                        // 标准化路径
                        const normalizedPath = realPath.replace(/\\/g, '/');
                        
                        // 尝试多种方式查找句柄
                        const handle = getFileHandle(normalizedPath) || 
                                       getFileHandle(realPath) || 
                                       getFileHandle(file.name);
                        
                        if (handle && handle.kind === 'file') {
                          const fileObj = await handle.getFile();
                          const content = await fileObj.text();
                          openDocument(file.path, content, false);
                          addFile(file.path, file.name);
                        } else {
                          // 文件句柄已失效，提示用户
                          alert(`文件句柄已失效，请从文件树中打开。\n查找路径: ${normalizedPath}`);
                        }
                      }
                    } catch (err) {
                      console.error('打开最近文件失败:', err);
                      alert(`打开文件失败: ${err}`);
                    }
                  }}
                >
                  <div className="w-4 h-4 flex items-center justify-center mr-2">
                    {file.isPinned ? (
                      <Pin size={12} className="text-[var(--accent-500)]" />
                    ) : (
                      <FileText size={14} className="text-[var(--editor-text-secondary)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--sidebar-text)] truncate">{file.name}</div>
                    <div className="text-xs text-[var(--sidebar-text-muted)]">{formatTime(file.lastOpened)}</div>
                  </div>
                  {hoveredPath === file.path && (
                    <div className="flex items-center gap-0.5">
                      <button
                        className="p-1 rounded hover:bg-[var(--sidebar-active)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          file.isPinned ? unpinFile(file.path) : pinFile(file.path);
                        }}
                        title={file.isPinned ? '取消置顶' : '置顶'}
                      >
                        {file.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                      </button>
                      <button
                        className="p-1 rounded hover:bg-[var(--sidebar-active)] text-[var(--sidebar-text-muted)] hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file.path);
                        }}
                        title="移除"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 px-4 text-center">
              <Clock size={32} className="text-[var(--sidebar-text-muted)] mb-2 opacity-50" />
              <p className="text-sm text-[var(--sidebar-text-muted)]">
                暂无最近打开的文件
              </p>
            </div>
          )
        )}
      </div>

      {/* 底部提示 */}
      <div className="px-3 py-2 text-xs text-[var(--sidebar-text-muted)] border-t border-[var(--sidebar-border)] flex items-center gap-1.5">
        <FileText size={12} />
        <span>支持拖放 .md 文件</span>
      </div>

      {/* 右键菜单 */}
      {contextMenu.visible && (
        <div
          className="fixed bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-lg shadow-lg py-1 z-50 min-w-[160px] animate-scale-in"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.recentFile ? (
            <>
              <ContextMenuItem
                icon={ExternalLink}
                label="在新Tab中打开"
                onClick={async () => {
                  const file = contextMenu.recentFile;
                  if (!file) return;
                  closeContextMenu();
                  try {
                    if (isTauriCached()) {
                      const { readTextFile } = await import('@tauri-apps/plugin-fs');
                      const realPath = file.path.replace(/^file:\/\//, '');
                      const content = await readTextFile(realPath);
                      openDocument(file.path, content, false);
                      addFile(file.path, file.name);
                    } else {
                      const { getFileHandle } = useFileStore.getState();
                      const realPath = file.path.replace(/^file:\/\//, '');
                      const normalizedPath = realPath.replace(/\\/g, '/');
                      const handle = getFileHandle(normalizedPath) || getFileHandle(realPath) || getFileHandle(file.name);
                      if (handle && handle.kind === 'file') {
                        const fileObj = await handle.getFile();
                        const content = await fileObj.text();
                        openDocument(file.path, content, false);
                        addFile(file.path, file.name);
                      }
                    }
                  } catch (err) {
                    console.error('打开最近文件失败:', err);
                  }
                }}
              />
              {hasSplitPanes && (
                <ContextMenuItem
                  icon={Columns}
                  label="在当前窗格中打开"
                  onClick={async () => {
                    const file = contextMenu.recentFile;
                    if (!file || !activeTabPath) return;
                    closeContextMenu();
                    
                    const existingDocs = getDocumentsInPanes(activeTabPath);
                    if (existingDocs.includes(file.path)) {
                      return;
                    }
                    
                    try {
                      let content: string;
                      if (isTauriCached()) {
                        const { readTextFile } = await import('@tauri-apps/plugin-fs');
                        const realPath = file.path.replace(/^file:\/\//, '');
                        content = await readTextFile(realPath);
                      } else {
                        const { getFileHandle } = useFileStore.getState();
                        const realPath = file.path.replace(/^file:\/\//, '');
                        const normalizedPath = realPath.replace(/\\/g, '/');
                        const handle = getFileHandle(normalizedPath) || getFileHandle(realPath) || getFileHandle(file.name);
                        if (handle && handle.kind === 'file') {
                          const fileObj = await handle.getFile();
                          content = await fileObj.text();
                        } else {
                          return;
                        }
                      }
                      const splitState = getCurrentState(activeTabPath);
                      if (splitState) {
                        ensureDocument(file.path, content, false);
                        setPaneDocument(activeTabPath, splitState.activePaneId, file.path);
                        setActivePane(activeTabPath, splitState.activePaneId);
                        addFile(file.path, file.name);
                      }
                    } catch (err) {
                      console.error('在窗格中打开最近文件失败:', err);
                    }
                  }}
                />
              )}
            </>
          ) : contextMenu.node?.isDir ? (
            <>
              <ContextMenuItem
                icon={RefreshCw}
                label="刷新"
                onClick={() => {
                  closeContextMenu();
                  refreshTree();
                }}
              />
              <div className="h-px bg-[var(--sidebar-border)] my-1" />
              <ContextMenuItem
                icon={Plus}
                label="新建文档"
                onClick={startNewFile}
              />
              <ContextMenuItem
                icon={FolderPlus}
                label="新建目录"
                onClick={startNewDir}
              />
              <div className="h-px bg-[var(--sidebar-border)] my-1" />
              <ContextMenuItem
                icon={Pencil}
                label="重命名"
                onClick={startRename}
              />
              {isTauriCached() && (
                <ContextMenuItem
                  icon={Trash2}
                  label="删除"
                  onClick={startDelete}
                  danger
                />
              )}
            </>
          ) : contextMenu.node ? (
            <>
              <ContextMenuItem
                icon={ExternalLink}
                label="在新Tab中打开"
                onClick={async () => {
                  const node = contextMenu.node;
                  if (!node) return;
                  closeContextMenu();
                  const docPath = `file://${node.path}`;
                  try {
                    if (isTauriCached()) {
                      const { readTextFile } = await import('@tauri-apps/plugin-fs');
                      const content = await readTextFile(node.path);
                      openDocument(docPath, content, false);
                    } else if (node.handle && node.handle.kind === 'file') {
                      setFileHandle(node.path, node.handle);
                      const file = await node.handle.getFile();
                      const content = await file.text();
                      openDocument(docPath, content, false);
                    }
                    addFile(docPath, node.name);
                  } catch (err) {
                    console.error('打开文件失败:', err);
                  }
                }}
              />
              {hasSplitPanes && (
                <ContextMenuItem
                  icon={Columns}
                  label="在当前窗格中打开"
                  onClick={async () => {
                    const node = contextMenu.node;
                    if (!node || !activeTabPath) return;
                    closeContextMenu();
                    await openFileInPane(node);
                  }}
                />
              )}
              <div className="h-px bg-[var(--sidebar-border)] my-1" />
              <ContextMenuItem
                icon={RefreshCw}
                label="刷新"
                onClick={() => {
                  closeContextMenu();
                  refreshTree();
                }}
              />
              <div className="h-px bg-[var(--sidebar-border)] my-1" />
              <ContextMenuItem
                icon={Pencil}
                label="重命名"
                onClick={startRename}
              />
              {isTauriCached() && (
                <ContextMenuItem
                  icon={Trash2}
                  label="删除"
                  onClick={startDelete}
                  danger
                />
              )}
            </>
          ) : null}
        </div>
      )}

      {/* 新建文件对话框 */}
      {newFileState && (
        <Dialog
          title="新建文档"
          placeholder="输入文件名（自动添加 .md 后缀）"
          inputRef={newFileInputRef}
          onConfirm={finishNewFile}
          onCancel={cancelNewFile}
        />
      )}

      {/* 新建目录对话框 */}
      {newDirState && (
        <Dialog
          title="新建目录"
          placeholder="输入目录名"
          inputRef={newDirInputRef}
          onConfirm={finishNewDir}
          onCancel={cancelNewDir}
        />
      )}

      {/* 删除确认对话框 */}
      {deleteState && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除${deleteState.isDir ? '文件夹' : '文件'} "${deleteState.name}" 吗？\n\n文件将被移动到回收站，可以从回收站恢复。`}
          confirmText="删除"
          danger
          onConfirm={finishDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

// 右键菜单项组件
interface ContextMenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ icon: Icon, label, onClick, danger = false }) => (
  <button
    className={`w-full px-3 py-2 text-sm text-left hover:bg-[var(--sidebar-hover)] flex items-center gap-2.5 transition-colors ${danger ? 'text-red-500 hover:text-red-600' : ''}`}
    onClick={onClick}
  >
    <Icon size={14} className={danger ? 'text-red-500' : 'text-[var(--sidebar-text-muted)]'} />
    <span>{label}</span>
  </button>
);

// 对话框组件
interface DialogProps {
  title: string;
  placeholder: string;
  inputRef: React.RefObject<HTMLInputElement>;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const Dialog: React.FC<DialogProps> = ({ title, placeholder, inputRef, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-xl p-5 shadow-2xl min-w-[320px] animate-scale-in">
      <h3 className="text-sm font-semibold mb-4 text-[var(--sidebar-text)]">{title}</h3>
      <input
        ref={inputRef}
        type="text"
        className="w-full px-3 py-2.5 text-sm border border-[var(--sidebar-border)] rounded-lg bg-[var(--editor-bg)] outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all"
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onConfirm(e.currentTarget.value);
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      <div className="flex justify-end gap-2 mt-4">
        <button
          className="px-4 py-2 text-sm rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-[var(--sidebar-text)]"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] transition-colors font-medium"
          onClick={() => {
            if (inputRef.current) {
              onConfirm(inputRef.current.value);
            }
          }}
        >
          创建
        </button>
      </div>
    </div>
  </div>
);

// 确认对话框组件
interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel
}) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-xl p-5 shadow-2xl min-w-[320px] max-w-[480px] animate-scale-in">
      <h3 className="text-sm font-semibold mb-3 text-[var(--sidebar-text)]">{title}</h3>
      <p className="text-sm text-[var(--sidebar-text-muted)] mb-4 whitespace-pre-wrap">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          className="px-4 py-2 text-sm rounded-lg hover:bg-[var(--sidebar-hover)] transition-colors text-[var(--sidebar-text)]"
          onClick={onCancel}
        >
          {cancelText}
        </button>
        <button
          className={`px-4 py-2 text-sm rounded-lg text-white transition-colors font-medium ${
            danger
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-[var(--accent-500)] hover:bg-[var(--accent-600)]'
          }`}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
      </div>
    </div>
  </div>
);

export default Sidebar;
