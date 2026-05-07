import { create } from 'zustand';

/**
 * 最近打开文件接口
 */
export interface RecentFile {
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 最后打开时间戳 */
  lastOpened: number;
  /** 是否置顶 */
  isPinned: boolean;
}

/**
 * 最近文件状态接口
 */
interface RecentFilesState {
  /** 最近文件列表 */
  recentFiles: RecentFile[];
  /** 最大存储数量 */
  maxCount: number;
  
  /** 添加/更新最近文件 */
  addFile: (path: string, name: string) => void;
  /** 移除最近文件 */
  removeFile: (path: string) => void;
  /** 清空所有记录 */
  clearAll: () => void;
  /** 置顶文件 */
  pinFile: (path: string) => void;
  /** 取消置顶 */
  unpinFile: (path: string) => void;
}

/** localStorage 存储键 */
const STORAGE_KEY = 'md-editor-recent-files';
/** 最大存储数量 */
const MAX_COUNT = 10;

/**
 * 从 localStorage 加载最近文件列表
 */
function loadFromStorage(): RecentFile[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

/**
 * 保存最近文件列表到 localStorage
 */
function saveToStorage(files: RecentFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

/**
 * 格式化时间显示
 * @param timestamp 时间戳
 * @returns 格式化后的时间字符串
 */
export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * 最近文件 Store
 */
export const useRecentFilesStore = create<RecentFilesState>((set, get) => ({
  recentFiles: loadFromStorage(),
  maxCount: MAX_COUNT,
  
  addFile: (path: string, name: string) => {
    const { recentFiles, maxCount } = get();
    const existing = recentFiles.findIndex(f => f.path === path);
    
    let newFiles = [...recentFiles];
    
    if (existing >= 0) {
      // 更新已存在的文件
      newFiles[existing] = {
        ...newFiles[existing],
        name,
        lastOpened: Date.now()
      };
      // 移到顶部（如果未置顶）
      const file = newFiles.splice(existing, 1)[0];
      newFiles.unshift(file);
    } else {
      // 添加新文件
      newFiles.unshift({
        path,
        name,
        lastOpened: Date.now(),
        isPinned: false
      });
    }
    
    // 移除超出限制的文件（置顶的除外）
    const pinnedCount = newFiles.filter(f => f.isPinned).length;
    const unpinned = newFiles.filter(f => !f.isPinned);
    if (unpinned.length > maxCount - pinnedCount) {
      unpinned.splice(maxCount - pinnedCount);
      newFiles = [...newFiles.filter(f => f.isPinned), ...unpinned];
    }
    
    // 按置顶和时间排序（置顶文件保持在顶部）
    newFiles.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastOpened - a.lastOpened;
    });
    
    saveToStorage(newFiles);
    set({ recentFiles: newFiles });
  },
  
  removeFile: (path: string) => {
    const newFiles = get().recentFiles.filter(f => f.path !== path);
    saveToStorage(newFiles);
    set({ recentFiles: newFiles });
  },
  
  clearAll: () => {
    saveToStorage([]);
    set({ recentFiles: [] });
  },
  
  pinFile: (path: string) => {
    const newFiles = get().recentFiles.map(f => 
      f.path === path ? { ...f, isPinned: true } : f
    );
    saveToStorage(newFiles);
    set({ recentFiles: newFiles });
  },
  
  unpinFile: (path: string) => {
    const newFiles = get().recentFiles.map(f => 
      f.path === path ? { ...f, isPinned: false } : f
    );
    saveToStorage(newFiles);
    set({ recentFiles: newFiles });
  }
}));
