/**
 * Markdown 工具函数
 */

/**
 * 检查文件是否是 Markdown 文件
 * @param filename - 文件名
 * @returns 是否是 .md 或 .markdown 文件
 * @example
 * isMarkdownFile('document.md') // true
 * isMarkdownFile('README.MD') // true
 * isMarkdownFile('file.txt') // false
 */
export function isMarkdownFile(filename: string): boolean {
  if (!filename) return false;
  const lowerName = filename.toLowerCase();
  return lowerName.endsWith('.md') || lowerName.endsWith('.markdown');
}

/**
 * 从 Markdown 内容中提取所有图片路径
 * 支持格式：![alt](path) 和 ![alt](path "title")
 * @param content - Markdown 文档内容
 * @returns 图片路径数组
 * @example
 * extractImagePaths('![img](./image.png) text ![pic](photo.jpg)')
 * // ['./image.png', 'photo.jpg']
 */
export function extractImagePaths(content: string): string[] {
  if (!content) return [];
  
  // 匹配 Markdown 图片语法：![...](path) 或 ![...](path "title")
  const imageRegex = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const paths: string[] = [];
  
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(content)) !== null) {
    const path = match[1];
    if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
      paths.push(path);
    }
  }
  
  return paths;
}

/**
 * 从图片路径生成默认的 alt 文本
 * 使用文件名（不含扩展名）作为 alt 文本
 * @param src - 图片路径
 * @returns alt 文本
 * @example
 * getImageAlt('./images/my-photo.png') // 'my photo'
 * getImageAlt('screenshot_2024.jpg') // 'screenshot 2024'
 */
export function getImageAlt(src: string): string {
  if (!src) return '';
  
  // 提取文件名（不含扩展名）
  const fileName = src
    .replace(/\\/g, '/')
    .split('/')
    .pop() || '';
  
  const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
  
  // 将下划线和连字符替换为空格
  return nameWithoutExt.replace(/[-_]+/g, ' ').trim();
}