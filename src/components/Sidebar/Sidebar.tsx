import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFileStore, useEditorStore, TreeNode } from '../../stores';
import { useFileOperations } from '../../hooks/useFileOperations';
import { isTauriCached } from '../../utils/platform';
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
  LucideIcon
} from 'lucide-react';

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  node: TreeNode | null;
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

export const Sidebar: React.FC = () => {
  const { fileTree, rootPath, setFileTree, setFileHandle, setDirHandle, rootHandle, dirHandles } = useFileStore();
  const { openDocument, renameDocument, documents } = useEditorStore();
  const { readDirectoryRecursive, readDirectoryTauri } = useFileOperations();

  // 获取 Tauri 环境下的完整根路径
  const getFullRootPath = useCallback(() => {
    console.log('[getFullRootPath] isTauriCached:', isTauriCached());
    console.log('[getFullRootPath] rootHandle:', rootHandle);
    console.log('[getFullRootPath] rootPath:', rootPath);
    
    if (isTauriCached() && rootHandle) {
      console.log('[getFullRootPath] 返回 rootHandle:', rootHandle);
      return rootHandle as unknown as string;
    }
    console.log('[getFullRootPath] 返回 rootPath:', rootPath);
    return rootPath;
  }, [rootHandle, rootPath]);

  // 将相对路径转换为绝对路径（Tauri 环境）
  const toAbsolutePath = useCallback((relativePath: string) => {
    console.log('[toAbsolutePath] 输入:', relativePath);
    
    if (isTauriCached()) {
      // 如果已经是绝对路径（Windows 包含盘符，Unix 以 / 开头），直接返回
      if (relativePath.includes(':') || relativePath.startsWith('/')) {
        console.log('[toAbsolutePath] 已是绝对路径，直接返回:', relativePath);
        return relativePath;
      }
      const fullRoot = getFullRootPath();
      if (!fullRoot) {
        console.log('[toAbsolutePath] fullRoot 为空，返回原路径');
        return relativePath;
      }
      const result = `${fullRoot}/${relativePath}`;
      console.log('[toAbsolutePath] 拼接结果:', result);
      return result;
    }
    console.log('[toAbsolutePath] 非 Tauri 环境，返回原路径');
    return relativePath;
  }, [getFullRootPath]);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    node: null
  });
  const [renameState, setRenameState] = useState<RenameState | null>(null);
  const [newFileState, setNewFileState] = useState<NewFileState | null>(null);
  const [newDirState, setNewDirState] = useState<NewDirState | null>(null);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [selectedDir, setSelectedDir] = useState<string | null>(null);

  const renameInputRef = useRef<HTMLInputElement>(null);
  const newFileInputRef = useRef<HTMLInputElement>(null);
  const newDirInputRef = useRef<HTMLInputElement>(null);

  // 拖放文件支持
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;

    for (const file of files) {
      if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
        const content = await file.text();
        const docPath = `file://${file.name}`;
        openDocument(docPath, content, false);
      }
    }
  }, [openDocument]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

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
          console.log(`[FileClick] 从文件系统加载: ${node.path}`);
        } else {
          // 浏览器环境
          if (node.handle && node.handle.kind === 'file') {
            setFileHandle(node.path, node.handle);
            const file = await node.handle.getFile();
            const content = await file.text();
            openDocument(docPath, content, false);
            console.log(`[FileClick] 从文件系统加载: ${node.path}`);
          }
        }
      } catch (err) {
        console.error('读取文件失败:', err);
      }
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
        console.log('[toggleDir] 延迟加载子目录:', path);
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
          console.log('[toggleDir] 子目录加载完成:', path, '子项数量:', children.length);
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
      node
    });
  };

  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
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
      const parentPath = contextMenu.node.isDir
        ? contextMenu.node.path
        : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'));

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
        // Tauri 环境 - 使用绝对路径
        const absoluteParentPath = toAbsolutePath(parentPath);
        const filePath = `${absoluteParentPath}/${finalName}`;
        console.log('[NewFile] Tauri 环境创建文件:', filePath);
        
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');
        await writeTextFile(filePath, defaultContent);
        
        // 刷新文件树
        const fullRoot = getFullRootPath();
        if (fullRoot) {
          const tree = await readDirectoryTauri(fullRoot);
          setFileTree(tree);
        }
        
        // 打开新文件
        openDocument(`file://${filePath}`, defaultContent, false);
        console.log(`[NewFile] 创建文件成功: ${finalName}`);
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

        console.log(`[NewFile] 创建文件成功: ${finalName}`);
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
      const parentPath = contextMenu.node.isDir
        ? contextMenu.node.path
        : contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/'));

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
        // Tauri 环境 - 使用绝对路径
        const absoluteParentPath = toAbsolutePath(parentPath);
        const dirPath = `${absoluteParentPath}/${dirName}`;
        console.log('[NewDir] Tauri 环境创建目录:', dirPath);
        
        const { mkdir } = await import('@tauri-apps/plugin-fs');
        await mkdir(dirPath);
        
        // 刷新文件树
        const fullRoot = getFullRootPath();
        if (fullRoot) {
          const tree = await readDirectoryTauri(fullRoot);
          setFileTree(tree);
        }
        
        console.log(`[NewDir] 创建目录成功: ${dirName}`);
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

        console.log(`[NewDir] 创建目录成功: ${dirName}`);
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
        console.log(`[Rename] 重命名新建文档: ${oldName} -> ${finalName}`);
      } else {
        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const oldEntryPath = `${parentPath}/${oldName}`;
        const newEntryPath = `${parentPath}/${finalName}`;

        try {
          if (isTauriCached()) {
            // Tauri 环境
            const { rename } = await import('@tauri-apps/plugin-fs');
            await rename(oldEntryPath, newEntryPath);

            // 刷新文件树
            const fullRoot = getFullRootPath();
            if (fullRoot) {
              const tree = await readDirectoryTauri(fullRoot);
              setFileTree(tree);
            }
            
            console.log(`[Rename] 重命名成功: ${oldName} -> ${finalName}`);
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
            
            console.log(`[Rename] 重命名成功: ${oldName} -> ${finalName}`);
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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Header */}
      <div className="h-10 flex items-center justify-between px-3 border-b border-[var(--sidebar-border)]">
        <span className="text-xs font-semibold text-[var(--sidebar-text-muted)] uppercase tracking-wider">
          文件浏览器
        </span>
        {rootHandle && (
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
              onClick={() => {
                setNewFileState({ parentPath: selectedDir || rootPath || '' });
              }}
              title={`新建文件${selectedDir ? ` (在 ${selectedDir.split('/').pop()} 中)` : ''}`}
            >
              <Plus size={14} />
            </button>
            <button
              className="p-1.5 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] transition-colors"
              onClick={() => {
                setNewDirState({ parentPath: selectedDir || rootPath || '' });
              }}
              title={`新建文件夹${selectedDir ? ` (在 ${selectedDir.split('/').pop()} 中)` : ''}`}
            >
              <FolderPlus size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 文件树 */}
      <div className="flex-1 overflow-auto py-2">
        {rootPath ? (
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
          {contextMenu.node?.isDir ? (
            <>
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
            </>
          ) : (
            <ContextMenuItem
              icon={Pencil}
              label="重命名"
              onClick={startRename}
            />
          )}
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
    </div>
  );
};

// 右键菜单项组件
interface ContextMenuItemProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

const ContextMenuItem: React.FC<ContextMenuItemProps> = ({ icon: Icon, label, onClick }) => (
  <button
    className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--sidebar-hover)] flex items-center gap-2.5 transition-colors"
    onClick={onClick}
  >
    <Icon size={14} className="text-[var(--sidebar-text-muted)]" />
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

export default Sidebar;
