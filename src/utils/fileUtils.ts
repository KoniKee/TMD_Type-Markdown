/**
 * 文件操作工具函数
 */

/**
 * 从路径中提取文件名（包含扩展名）
 * @param path - 文件路径
 * @returns 文件名
 * @example
 * getFileName('/path/to/document.md') // 'document.md'
 * getFileName('C:\\Users\\file.txt') // 'file.txt'
 */
export function getFileName(path: string): string {
  if (!path) return '';
  // 处理 Windows 和 Unix 路径分隔符
  const normalizedPath = path.replace(/\\/g, '/');
  const parts = normalizedPath.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * 获取文件扩展名（不包含点）
 * @param path - 文件路径或文件名
 * @returns 扩展名（小写）
 * @example
 * getFileExtension('document.MD') // 'md'
 * getFileExtension('image.png') // 'png'
 */
export function getFileExtension(path: string): string {
  if (!path) return '';
  const fileName = getFileName(path);
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) return '';
  return fileName.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * 获取父目录路径
 * @param path - 文件或目录路径
 * @returns 父目录路径
 * @example
 * getParentPath('/path/to/file.md') // '/path/to'
 * getParentPath('/path/to/dir/') // '/path/to'
 */
export function getParentPath(path: string): string {
  if (!path) return '';
  // 处理 Windows 和 Unix 路径分隔符
  const normalizedPath = path.replace(/\\/g, '/');
  // 移除末尾的斜杠
  const trimmedPath = normalizedPath.replace(/\/+$/, '');
  const lastSlashIndex = trimmedPath.lastIndexOf('/');
  if (lastSlashIndex === -1) return '';
  if (lastSlashIndex === 0) return '/';
  return trimmedPath.slice(0, lastSlashIndex);
}

/**
 * 拼接路径片段
 * @param parts - 路径片段
 * @returns 拼接后的路径
 * @example
 * joinPath('/path', 'to', 'file.md') // '/path/to/file.md'
 * joinPath('C:\\Users', 'docs', 'file.md') // 'C:/Users/docs/file.md'
 */
export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return '';
  
  const joined = parts
    .filter(part => part !== '')
    .map(part => part.replace(/\\/g, '/'))
    .join('/');
  
  // 规范化路径：移除多余的斜杠
  return joined.replace(/\/+/g, '/');
}

/**
 * 生成唯一的图片文件名
 * @returns 图片文件名，格式：image-{timestamp}-{random}.png
 * @example
 * generateImageName() // 'image-1701234567890-a3f2.png'
 */
export function generateImageName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6);
  return `image-${timestamp}-${random}.png`;
}