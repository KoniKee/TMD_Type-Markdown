/**
 * 平台检测和文件操作工具
 * 统一处理浏览器和 Tauri 环境的差异
 */

// 使用 Tauri 官方 API 检测环境（异步）
export const isTauri = async (): Promise<boolean> => {
  try {
    const { isTauri: checkTauri } = await import('@tauri-apps/api/core');
    return checkTauri();
  } catch {
    return false;
  }
};

// 同步检测（用于初始化阶段）
// Tauri 2.0 withGlobalTauri 模式下，window.__TAURI__ 存在
let _isTauriCache: boolean | null = null;
let _isTauriAsyncCache: boolean | null = null;

export const isTauriCached = (): boolean => {
  if (_isTauriCache === null) {
    _isTauriCache = typeof window !== 'undefined' && (
      '__TAURI__' in window ||
      '__TAURI_INTERNALS__' in window ||
      navigator.userAgent.includes('Tauri')
    );
  }
  return _isTauriCache;
};

export const waitForTauri = async (): Promise<boolean> => {
  if (_isTauriAsyncCache !== null) {
    return _isTauriAsyncCache;
  }
  
  try {
    const { isTauri: checkTauri } = await import('@tauri-apps/api/core');
    const result = await checkTauri();
    _isTauriAsyncCache = result;
    _isTauriCache = result;
    return result;
  } catch (e) {
    _isTauriAsyncCache = false;
    return false;
  }
};

// 重置缓存（用于测试）
export const resetTauriCache = () => {
  _isTauriCache = null;
  _isTauriAsyncCache = null;
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
    if (isTauriCached()) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      return await readTextFile(path);
    } else {
      // 浏览器环境需要传入 handle
      throw new Error('Browser environment requires file handle');
    }
  },

  // 写入文本文件
  async writeTextFile(path: string, content: string): Promise<void> {
    if (isTauriCached()) {
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
    if (isTauriCached()) {
      const { mkdir } = await import('@tauri-apps/plugin-fs');
      await mkdir(path, { recursive: true });
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 删除文件
  async removeFile(path: string): Promise<void> {
    if (isTauriCached()) {
      const { remove } = await import('@tauri-apps/plugin-fs');
      await remove(path);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 重命名文件
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    if (isTauriCached()) {
      const { rename } = await import('@tauri-apps/plugin-fs');
      await rename(oldPath, newPath);
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 读取目录
  async readDir(path: string): Promise<Array<{ name: string; isFile: boolean; isDirectory: boolean }>> {
    if (isTauriCached()) {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(path);
      return entries.map(entry => ({
        name: entry.name!,
        isFile: entry.isFile!,
        isDirectory: entry.isDirectory!,
      }));
    } else {
      throw new Error('Browser environment requires directory handle');
    }
  },

  // 检查文件是否存在
  async exists(path: string): Promise<boolean> {
    if (isTauriCached()) {
      const { exists } = await import('@tauri-apps/plugin-fs');
      return await exists(path);
    } else {
      throw new Error('Browser environment requires file handle');
    }
  },

  // 获取临时文件目录路径
  async getTempDir(): Promise<string | null> {
    if (isTauriCached()) {
      try {
        const { documentDir } = await import('@tauri-apps/api/path');
        const docDir = await documentDir();
        if (!docDir) return null;
        
        const tempDir = `${docDir}.md-editor${window.navigator.platform.toLowerCase().includes('win') ? '\\' : '/'}temp`;
        
        // 确保目录存在
        const { mkdir } = await import('@tauri-apps/plugin-fs');
        try {
          await mkdir(tempDir, { recursive: true });
        } catch (e: any) {
          // 目录可能已存在，忽略错误
          if (!e.message?.includes('already exists')) {
            console.error('[TempDir] 创建临时目录失败:', e);
          }
        }
        
        return tempDir;
      } catch (e) {
        console.error('[TempDir] 获取临时目录失败:', e);
        return null;
      }
    }
    return null;
  },
};
