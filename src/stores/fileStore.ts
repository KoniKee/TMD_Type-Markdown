import { create } from 'zustand';

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: TreeNode[];
  handle?: FileSystemDirectoryHandle | FileSystemFileHandle | File;
}

interface FileState {
  rootPath: string | null;
  fileTree: TreeNode[];
  selectedPath: string | null;
  isLoading: boolean;
  fileHandles: Map<string, FileSystemFileHandle>;
  dirHandles: Map<string, FileSystemDirectoryHandle>; // 路径 -> 目录句柄
  rootHandle: FileSystemDirectoryHandle | null;

  setRootPath: (path: string) => void;
  setFileTree: (tree: TreeNode[]) => void;
  selectFile: (path: string) => void;
  refreshTree: () => void;
  refreshFileTree: () => Promise<void>;
  setFileHandle: (fileName: string, handle: FileSystemFileHandle) => void;
  getFileHandle: (fileName: string) => FileSystemFileHandle | undefined;
  setDirHandle: (path: string, handle: FileSystemDirectoryHandle) => void;
  getDirHandle: (path: string) => FileSystemDirectoryHandle | undefined;
  setRootHandle: (handle: FileSystemDirectoryHandle | null) => void;
  clearAll: () => void; // 新增：清理所有状态
}

export const useFileStore = create<FileState>((set, get) => ({
  rootPath: null,
  fileTree: [],
  selectedPath: null,
  isLoading: false,
  fileHandles: new Map(),
  dirHandles: new Map(),
  rootHandle: null,

  setRootPath: (path: string) => set({ rootPath: path }),

  setFileTree: (tree: TreeNode[]) => set({ fileTree: tree }),

  selectFile: (path: string) => set({ selectedPath: path }),

  refreshTree: () => {
    const { rootPath } = get();
    if (rootPath) {
      set({ isLoading: true });
      setTimeout(() => set({ isLoading: false }), 100);
    }
  },

  // 刷新文件树 - 重新扫描目录
  refreshFileTree: async () => {
    const { rootHandle, rootPath, dirHandles } = get();
    
    if (!rootHandle || !rootPath) {
      return;
    }
    
    set({ isLoading: true });
    
    try {
      const readDirectoryRecursive = async (
        dirHandle: FileSystemDirectoryHandle, 
        basePath: string
      ): Promise<TreeNode[]> => {
        const nodes: TreeNode[] = [];
        
        const newDirHandles = new Map(get().dirHandles);
        newDirHandles.set(basePath, dirHandle);
        set({ dirHandles: newDirHandles });
        
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
      };
      
      const tree = await readDirectoryRecursive(rootHandle, rootPath);
      set({ fileTree: tree, isLoading: false });
    } catch (err) {
      console.error('[RefreshFileTree] 刷新失败:', err);
      set({ isLoading: false });
    }
  },

  setFileHandle: (fileName: string, handle: FileSystemFileHandle) => {
    const { fileHandles } = get();
    const newHandles = new Map(fileHandles);
    newHandles.set(fileName, handle);
    set({ fileHandles: newHandles });
  },

  getFileHandle: (fileName: string) => {
    return get().fileHandles.get(fileName);
  },

  setDirHandle: (path: string, handle: FileSystemDirectoryHandle) => {
    const { dirHandles } = get();
    const newHandles = new Map(dirHandles);
    newHandles.set(path, handle);
    set({ dirHandles: newHandles });
  },

  getDirHandle: (path: string) => {
    return get().dirHandles.get(path);
  },

  setRootHandle: (handle: FileSystemDirectoryHandle | null) => {
    set({ rootHandle: handle });
  },
  
  clearAll: () => {
    set({
      rootPath: null,
      fileTree: [],
      selectedPath: null,
      fileHandles: new Map(),
      dirHandles: new Map(),
      rootHandle: null,
    });
  },
}));
