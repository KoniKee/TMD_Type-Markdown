/**
 * 平台检测和文件操作工具
 * 统一处理浏览器和 Tauri 环境的差异
 */

// 检测是否在 Tauri 环境中 - 使用多种方式确保准确性
export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // 方式1: 检查 __TAURI__ 全局对象
  if ('__TAURI__' in window) return true;
  
  // 方式2: 检查 __TAURI_INTERNALS__
  if ('__TAURI_INTERNALS__' in window) return true;
  
  // 方式3: 检查 userAgent
  if (navigator.userAgent.includes('Tauri')) return true;
  
  // 方式4: 检查 tauri 协议
  if (window.location.protocol === 'tauri:' || window.location.hostname === 'tauri.localhost') return true;
  
  return false;
};

// 缓存结果，避免重复检测
let _isTauriCache: boolean | null = null;
export const isTauriCached = (): boolean => {
  if (_isTauriCache === null) {
    _isTauriCache = isTauri();
    console.log('[Platform] Tauri 环境检测:', _isTauriCache);
    console.log('[Platform] location.href:', window.location.href);
    console.log('[Platform] location.protocol:', window.location.protocol);
    console.log('[Platform] location.hostname:', window.location.hostname);
    console.log('[Platform] __TAURI__ exists:', '__TAURI__' in window);
    console.log('[Platform] __TAURI_INTERNALS__ exists:', '__TAURI_INTERNALS__' in window);
  }
  return _isTauriCache;
};

// 检测是否在浏览器环境且支持 File System Access API
export const isFileSystemAccessSupported = (): boolean => {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
};

/**
 * 文件操作封装
 */
export const fileOps = {
  // 读取文本文件
  async readTextFile(path: string): Promise<string> {
    if (isTauri()) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      return await readTextFile(path);
    } else {
      // 浏览器环境需要传入 handle
      throw new Error('Browser environment requires file handle');
    }
  },

  // 写入文本文件
  async writeTextFile(path: string, content: string): Promise<void> {
    if (isTauri()) {
      const { writeFile } = await import('@tauri-apps/plugin-fs');
      const encoder = new TextEncoder();
      await writeFile(path, encoder.encode(content));
    } else {
      // 浏览器环境需要传入 handle
      throw new Error('Browser environment requires file handle');
    }
  },

  // 创建目录
  async createDir(path: string): Promise<void> {
    if (isTauri()) {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      await mkdir(path, { recursive: true });
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 删除文件
  async removeFile(path: string): Promise<void> {
    if (isTauri()) {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(path);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 重命名文件
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (isTauri()) {
      const { rename } = await import('@tauri-apps/plugin-fs');
      await rename(oldPath, newPath);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 读取目录
  async readDir(path: string): Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>> {
    if (isTauri()) {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(path);
      return entries.map(entry => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
      }));
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 检查文件是否存在
  async exists(path: string): Promise<boolean> {
    if (isTauri()) {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } else {
      throw new Error('Browser environment requires file handle');
    }
  },
};
