import React, { useRef, useEffect, useState, useCallback } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './vditor-styles.css';
import '../../styles/embed.css';
import { useEditorStore, useFileStore, useSettingsStore, EditorMode, PreviewMode, THEMES } from '../../stores';
import type { ThemeId } from '../../stores';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSaveToFile, useSaveAsFile } from '../../hooks/useAutoSave';
import { useShortcut } from '../../hooks/useShortcutManager';
import { isTauriCached, waitForTauri, platformPathSeparator } from '../../utils/platform';
import { isLocalMdFile, resolveDocPath, readMdFileContent, getFileDisplayName, normalizePath, getFileName } from '../../utils/linkUtils';
import { shouldRenderEmbed, processEmbedsInMarkdown, createEmbedContainer, createEmbedWarning, EmbedContext } from '../../utils/embedUtils';
import EmojiPicker from './EmojiPicker';
import ReplaceDialog from './ReplaceDialog';
import AlertsPicker from './AlertsPicker';
import { initHeadingFolding, refreshHeadingFolding, destroyHeadingFolding } from './HeadingFolding';

// 本地化 Vditor CDN 路径
const VDITOR_CDN = './vditor';

// debounce 工具函数
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  }) as T;
}

interface VditorEditorProps {
  path: string;
  isInPane?: boolean;
}

let tableTipTimeout: number | null = null;
let tableTipElement: HTMLDivElement | null = null;
let hasShownTableTip = false;

// 计算纯文本字数（去除 markdown 语法标记）
function countPlainText(md: string): number {
  if (!md) return 0;
  
  let text = md;
  
  // 移除代码块
  text = text.replace(/```[\s\S]*?```/g, '');
  
  // 移除行内代码
  text = text.replace(/`[^`]+`/g, '');
  
  // 移除图片 ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  
  // 移除链接 [text](url) → text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  
  // 移除粗体 **text** 或 __text__
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  
  // 移除斜体 *text* 或 _text_
  text = text.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
  text = text.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '$1');
  
  // 移除删除线 ~~text~~
  text = text.replace(/~~([^~]+)~~/g, '$1');
  
  // 移除高亮 ==text==
  text = text.replace(/==([^=]+)==/g, '$1');
  
  // 移除上标 ^text^
  text = text.replace(/\^([^^\n]+)\^/g, '$1');
  
  // 移除下标 ~text~ (单个波浪线，排除删除线)
  text = text.replace(/(?<!~)~([^~\n]+)~(?!~)/g, '$1');
  
  // 移除标题标记
  text = text.replace(/^#{1,6}\s*/gm, '');
  
  // 移除列表标记
  text = text.replace(/^[\t ]*[-*+]\s+/gm, '');
  text = text.replace(/^[\t ]*\d+\.\s+/gm, '');
  
  // 移除引用标记
  text = text.replace(/^>\s*/gm, '');
  
  // 移除水平线
  text = text.replace(/^[-*_]{3,}$/gm, '');
  
  // 移除 [toc]
  text = text.replace(/\[toc\]/gi, '');
  
  // 移除 HTML 标签
  text = text.replace(/<[^>]+>/g, '');
  
  // 移除多余空白字符
  text = text.replace(/[\n\r]+/g, '');
  text = text.trim();
  
  return text.length;
}

// 文件转 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 加载本地图片，返回blob URL
async function loadLocalImage(imageSrc: string, docPath: string): Promise<string | null> {
  // 解析图片路径
  const cleanSrc = imageSrc.replace(/^\.\//, '');
  
  try {
    if (isTauriCached()) {
      // Tauri 环境：读取文件转为 blob URL
      const { readFile } = await import('@tauri-apps/plugin-fs');
      
      // 从文档路径提取目录路径
      let docDir = '';
      if (docPath.startsWith('file://')) {
        const fullPath = docPath.replace('file://', '');
        const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
        if (lastSlash > 0) {
          docDir = fullPath.substring(0, lastSlash);
        }
      }
      
      const sep = platformPathSeparator();
      const normalizedSrc = cleanSrc.replace(/\//g, sep);
      const imagePath = `${docDir}${sep}${normalizedSrc}`;
      const imageData = await readFile(imagePath);
      const blob = new Blob([imageData]);
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    } else {
      // 浏览器环境
      const { rootHandle, dirHandles } = useFileStore.getState();
      
      if (!rootHandle) return null;
      
      // 从文档路径提取目录路径
      let docDirHandle: FileSystemDirectoryHandle = rootHandle;
      
      if (docPath.startsWith('file://')) {
        const fullPath = docPath.replace('file://', '');
        const lastSlash = fullPath.lastIndexOf('/');
        if (lastSlash > 0) {
          const dirPath = fullPath.substring(0, lastSlash);
          const foundHandle = dirHandles.get(dirPath);
          if (foundHandle) {
            docDirHandle = foundHandle;
          }
        }
      }
      
      const parts = cleanSrc.split('/');
      
      // 遍历路径找到图片文件
      let currentDir = docDirHandle;
      for (let i = 0; i < parts.length - 1; i++) {
        currentDir = await currentDir.getDirectoryHandle(parts[i]);
      }
      
      const fileName = parts[parts.length - 1];
      const fileHandle = await currentDir.getFileHandle(fileName);
      const file = await fileHandle.getFile();
      
      // 创建blob URL
      const blobUrl = URL.createObjectURL(file);
      return blobUrl;
    }
  } catch (err) {
    return null;
  }
}

// 处理单个图片元素
function handleLocalImage(img: HTMLImageElement, docPath: string) {
  const src = img.getAttribute('src');
  if (!src) return;
  
  // 只处理相对路径的本地图片
  if (src.startsWith('http') || src.startsWith('data:') || src.startsWith('blob:')) return;
  
  // 标记为正在处理，避免重复处理
  if (img.dataset.loading === 'true') return;
  img.dataset.loading = 'true';
  
  loadLocalImage(src, docPath).then((blobUrl) => {
    if (blobUrl) {
      img.src = blobUrl;
    }
    img.dataset.loading = 'false';
  });
}

// 处理容器中的所有本地图片
function processLocalImages(container: HTMLElement, docPath: string) {
  const imgs = container.querySelectorAll('img');
  imgs.forEach(img => handleLocalImage(img, docPath));
}

function showTableShortcutTip() {
  if (hasShownTableTip) return;
  hasShownTableTip = true;
  
  if (tableTipElement) {
    tableTipElement.remove();
    tableTipElement = null;
  }
  if (tableTipTimeout) {
    clearTimeout(tableTipTimeout);
  }
  
  const tip = document.createElement('div');
  tip.className = 'table-shortcut-tip';
  tip.innerHTML = `
    <div class="tip-title">📊 表格操作提示</div>
    <div class="tip-content">
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>=</kbd> 添加行</div>
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>-</kbd> 删除行</div>
      <div class="tip-item"><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>=</kbd> 添加列</div>
      <div class="tip-item"><kbd>Tab</kbd> 下一单元格</div>
    </div>
    <div class="tip-footer">💡 在表格内按 Enter 会换行，不是新增行</div>
  `;
  tip.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    background: var(--sidebar-bg, #f5f5f5);
    border: 1px solid var(--editor-border, #e0e0e0);
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 13px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 280px;
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    .table-shortcut-tip .tip-title {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--editor-text, #333);
    }
    .table-shortcut-tip .tip-item {
      margin: 4px 0;
      color: var(--editor-text-secondary, #666);
    }
    .table-shortcut-tip kbd {
      background: var(--editor-code-bg, #f5f5f5);
      border: 1px solid var(--editor-border, #e0e0e0);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: inherit;
      font-size: 12px;
    }
    .table-shortcut-tip .tip-footer {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--editor-border, #e0e0e0);
      font-size: 12px;
      color: var(--editor-text-secondary, #666);
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(tip);
  tableTipElement = tip;
  
  tableTipTimeout = window.setTimeout(() => {
    if (tableTipElement) {
      tableTipElement.style.opacity = '0';
      tableTipElement.style.transition = 'opacity 0.3s';
      setTimeout(() => {
        tableTipElement?.remove();
        tableTipElement = null;
      }, 300);
    }
  }, 5000);
}

export const VditorEditor = React.memo<VditorEditorProps>(({ path, isInPane }) => {
  const vditorRef = useRef<Vditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateDocument = useEditorStore((state) => state.updateDocument);
  const openDocument = useEditorStore((state) => state.openDocument);
  const setEditorMode = useEditorStore((state) => state.setEditorMode);
  const setScrollPosition = useEditorStore((state) => state.setScrollPosition);
  const setPreviewMode = useEditorStore((state) => state.setPreviewMode);
  const docState = useEditorStore((state) => state.documents[path]);
  const saveToFile = useSaveToFile();
  const saveAsFile = useSaveAsFile();
  const embedMaxDepth = useSettingsStore((state) => state.embedMaxDepth);
  const embedMaxCount = useSettingsStore((state) => state.embedMaxCount);
  const editorWidth = useSettingsStore((state) => state.editorWidth);
  const lineHeight = useSettingsStore((state) => state.lineHeight);
  const headingFolding = useSettingsStore((state) => state.headingFolding);
  const rootHandle = useFileStore((state) => state.rootHandle);
  const isInitializedRef = useRef(false);
  const currentPathRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const [initKey, setInitKey] = useState(0);
  const processedEmbedsRef = useRef<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showReplaceDialog, setShowReplaceDialog] = useState(false);
  const [showAlertsPicker, setShowAlertsPicker] = useState(false);
  
  // 字数统计节流 - 使用ref保存debounce函数
  const wordCountDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateWordCountDebounced = useCallback(() => {
    if (wordCountDebounceRef.current) {
      clearTimeout(wordCountDebounceRef.current);
    }
    wordCountDebounceRef.current = setTimeout(() => {
      const md = vditorRef.current?.getValue() || '';
      const plainText = countPlainText(md);
      const store = useEditorStore.getState();
      store.setMarkdownLength(md.length);
      store.setWordCount(plainText);
    }, 300);
  }, []);
  
  const getRootPath = useCallback(() => {
    if (isTauriCached() && rootHandle) {
      return rootHandle as unknown as string;
    }
    return undefined;
  }, [rootHandle]);
  
  const pathRef = useRef(path);
  const openDocumentRef = useRef(openDocument);
  const setEditorModeRef = useRef(setEditorMode);
  const setScrollPositionRef = useRef(setScrollPosition);
  const setPreviewModeRef = useRef(setPreviewMode);
  
  useEffect(() => {
    pathRef.current = path;
  }, [path]);
  
  useEffect(() => {
    openDocumentRef.current = openDocument;
  }, [openDocument]);
  
  useEffect(() => {
    setEditorModeRef.current = setEditorMode;
  }, [setEditorMode]);
  
  useEffect(() => {
    setScrollPositionRef.current = setScrollPosition;
  }, [setScrollPosition]);
  
  useEffect(() => {
    setPreviewModeRef.current = setPreviewMode;
  }, [setPreviewMode]);

  useShortcut('modeSwitch', (e: KeyboardEvent) => {
    const toolbar = containerRef.current?.querySelector('.vditor-toolbar');
    if (!toolbar) return;

    const currentMode = vditorRef.current?.getCurrentMode();
    const targetMode = currentMode === 'ir' ? 'sv' : 'ir';

    const buttons = toolbar.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';

      if ((targetMode === 'ir' && text.includes('即时渲染')) ||
          (targetMode === 'sv' && text.includes('分屏预览'))) {
        (btn as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        (btn as HTMLElement).click();
        return;
      }
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || !e.ctrlKey) return;
      if (e.key !== '7' && e.key !== '8' && e.key !== '9') return;

      e.preventDefault();
      e.stopPropagation();

      const targetMode = e.key === '7' ? 'wysiwyg' : e.key === '8' ? 'ir' : 'sv';
      const toolbar = container.querySelector('.vditor-toolbar');
      if (!toolbar) return;
      const buttons = toolbar.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        if ((targetMode === 'wysiwyg' && text.includes('所见即所得')) ||
            (targetMode === 'ir' && text.includes('即时渲染')) ||
            (targetMode === 'sv' && text.includes('分屏预览'))) {
          (btn as HTMLElement).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          (btn as HTMLElement).click();
          return;
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown as EventListener, true);
    return () => container.removeEventListener('keydown', handleKeyDown as EventListener, true);
  }, []);

  useShortcut('findReplace', () => {
    setShowReplaceDialog(true);
  }, []);

  useShortcut('alerts', () => {
    setShowAlertsPicker(true);
  }, []);

  useShortcut('save', (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    saveToFile();
  }, [saveToFile]);

  useShortcut('saveAs', (e: KeyboardEvent) => {
    e.stopImmediatePropagation();
    saveAsFile();
  }, [saveAsFile]);
  
  // 编辑区拖放文件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleDrop = async (e: DragEvent) => {
      const paneLeaf = container.closest('.pane-leaf');
      if (paneLeaf) {
        return;
      }
      
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      
      const mdFiles = Array.from(files).filter(
        file => file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')
      );
      
      if (mdFiles.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        
        for (const file of mdFiles) {
          const content = await file.text();
          openDocument(`file://${file.name}`, content, false);
        }
      }
    };
    
    const handleDragOver = (e: DragEvent) => {
      const paneLeaf = container.closest('.pane-leaf');
      if (paneLeaf) {
        return;
      }
      
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const hasMdFile = Array.from(files).some(
          file => file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')
        );
        if (hasMdFile) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    
    container.addEventListener('drop', handleDrop, true);
    container.addEventListener('dragover', handleDragOver, true);
    
    return () => {
      container.removeEventListener('drop', handleDrop, true);
      container.removeEventListener('dragover', handleDragOver, true);
    };
  }, [openDocument]);

  const handleLocalMdLinkClick = useCallback(async (href: string): Promise<boolean> => {
    if (!href || !isLocalMdFile(href)) {
      return false;
    }
    
    const rootPath = getRootPath();
    const resolvedPath = resolveDocPath(href, pathRef.current, rootPath);
    const docPath = `file://${resolvedPath}`;
    
    try {
      const result = await readMdFileContent(resolvedPath);
      
      if (result.content !== undefined) {
        openDocumentRef.current(docPath, result.content, false);
        return true;
      } else {
        alert(`无法打开文档: ${result.error || '文件不存在'}`);
      }
    } catch (err) {
      alert(`打开文档失败: ${err}`);
    }
    
    return false;
  }, [getRootPath]);

  // 监听内容延迟加载（只对未初始化的文档）
  useEffect(() => {
    if (isInitializedRef.current) return;
    if (currentPathRef.current === path && contentRef.current) return;
    
    const unsubscribe = useEditorStore.subscribe((state) => {
      const doc = state.documents[path];
      if (doc?.content && !isInitializedRef.current && currentPathRef.current === path && !contentRef.current) {
        // 内容已加载，触发重新初始化
        setInitKey(k => k + 1);
      }
    });
    
    return unsubscribe;
  }, [path]);

  // 监听外部内容变化（文件重新加载）
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state, prevState) => {
      const doc = state.documents[path];
      const prevDoc = prevState.documents[path];
      
      if (doc && prevDoc && 
          doc.content !== prevDoc.content && 
          !doc.isModified && 
          doc.content !== vditorRef.current?.getValue()) {
        const normalized = doc.content.replace(/^》\s/gm, '> ');
        vditorRef.current?.setValue(normalized);
        contentRef.current = normalized;
      }
    });
    
    return unsubscribe;
  }, [path]);

  // 当 path 变化时初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;
    
    const documents = useEditorStore.getState().documents;
    const doc = documents[path];
    if (!doc) {
      return;
    }
    
    if (isInitializedRef.current && currentPathRef.current === path) {
      return;
    }

    if (vditorRef.current) {
      vditorRef.current.destroy();
      vditorRef.current = null;
    }

    currentPathRef.current = path;
    contentRef.current = (doc.content || '').replace(/^》\s/gm, '> ');
    isInitializedRef.current = false;

    // 获取保存的状态 - 从当前store获取最新状态
    const currentDocState = useEditorStore.getState().documents[path];
    const savedEditorMode = currentDocState?.editorMode ?? 'ir';
    const savedScrollPosition = currentDocState?.scrollPosition ?? 0;
    const savedPreviewMode = currentDocState?.previewMode ?? 'editor';
    
    const processAlerts = (container: HTMLElement) => {
      // IR 模式下 Vditor 在首段插入 .vditor-ir__marker (内容 ">")，
      // 导致 textContent 为 "> [!NOTE] text"，需要灵活匹配
      const ALERT_RE = /^(?:>\s*)?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;
      
      const blockquotes = container.querySelectorAll('blockquote:not(.alert)');
      
      blockquotes.forEach((bq) => {
        const firstP = bq.querySelector('p:first-child');
        if (!firstP) return;
        
        const text = firstP.textContent || '';
        const match = text.match(ALERT_RE);
        
        if (match) {
          const typeUpper = match[1].toUpperCase();
          const typeLower = match[1].toLowerCase();
          const remaining = text.substring(match[0].length).trim();
          
          bq.classList.add('alert', `alert-${typeLower}`);
          bq.setAttribute('data-alert-title', typeUpper);
          firstP.setAttribute('data-alert-title', typeUpper);
          
          // 预览区（不可编辑）安全移除 [!NOTE] 文本
          const isInPreview = !!(bq.closest('.vditor-preview') ||
                                 bq.closest('.vditor-ir__preview') ||
                                 bq.closest('.vditor-sv__preview'));
          
          if (isInPreview) {
            if (remaining) {
              firstP.textContent = remaining;
            } else {
              firstP.textContent = '';
              (firstP as HTMLElement).style.display = 'none';
            }
          }
        }
      });

      // 清理：仅对 IR 编辑区的 blockquote
      container.querySelectorAll('blockquote.alert[data-alert-title]').forEach((bq) => {
        const isInPreview = !!(bq.closest('.vditor-preview') ||
                               bq.closest('.vditor-ir__preview') ||
                               bq.closest('.vditor-sv__preview'));
        if (isInPreview) return;
        
        const isInWysiwyg = !!bq.closest('.vditor-wysiwyg');
        if (isInWysiwyg) return;
        
        const firstP = bq.querySelector('p:first-child');
        if (!firstP) {
          bq.classList.remove('alert', 'alert-note', 'alert-tip', 'alert-important', 'alert-warning', 'alert-caution');
          bq.removeAttribute('data-alert-title');
          return;
        }
        const text = firstP.textContent || '';
        if (!text.match(ALERT_RE)) {
          bq.classList.remove('alert', 'alert-note', 'alert-tip', 'alert-important', 'alert-warning', 'alert-caution');
          bq.removeAttribute('data-alert-title');
          return;
        }
      });
    };
    
    const vditor = new Vditor(containerRef.current, {
      mode: savedEditorMode,
      height: '100%',
      theme: (() => {
        const themeAttr = document.documentElement.getAttribute('data-theme') as ThemeId | null;
        return (themeAttr && THEMES[themeAttr]?.group === 'dark') ? 'dark' : 'classic';
      })(),
      toolbarConfig: {
        pin: true,
      },
      outline: {
        enable: !isInPane,
        position: 'right',
      },
      cdn: VDITOR_CDN,
      preview: {
        markdown: {
          codeBlockPreview: true,
          mathBlockPreview: true,
          toc: true,
          mark: true,
          sup: true,
          sub: true,
        } as any,
      },
      hint: {
        parse: false,
        emoji: {
          // 常用表情
          'smile': '😊', 'laugh': '😄', 'wink': '😉', 'love': '😍',
          'cool': '😎', 'think': '🤔', 'sad': '😢', 'cry': '😭',
          'angry': '😠', 'surprised': '😮', 'sleepy': '😴', 'sick': '🤒',
          // 手势
          'ok': '👌', 'thumbsup': '👍', 'thumbsdown': '👎', 'clap': '👏',
          'pray': '🙏', 'fist': '✊', 'victory': '✌️', 'muscle': '💪',
          // 爱心
          'heart': '❤️', 'blue_heart': '💙', 'green_heart': '💚',
          'yellow_heart': '💛', 'purple_heart': '💜', 'sparkling_heart': '💖',
          // 符号
          'check': '✅', 'cross': '❌', 'warning': '⚠️', 'star': '⭐',
          'sparkles': '✨', 'fire': '🔥', 'rocket': '🚀', 'bulb': '💡',
          // 物品
          'book': '📖', 'pencil': '📝', 'memo': '📋', 'link': '🔗',
          'lock': '🔒', 'key': '🔑', 'computer': '💻', 'email': '📧',
          'phone': '📞', 'camera': '📷',
          // 自然
          'sunny': '☀️', 'cloud': '☁️', 'rainbow': '🌈', 'flower': '🌸',
          'tree': '🌳', 'apple': '🍎', 'banana': '🍌', 'watermelon': '🍉',
          // 动物
          'dog': '🐕', 'cat': '🐱', 'rabbit': '🐰', 'panda': '🐼',
          'bird': '🐦', 'fish': '🐟', 'butterfly': '🦋', 'bee': '🐝',
          // 食物
          'coffee': '☕', 'tea': '🍵', 'beer': '🍺', 'cake': '🍰',
          'pizza': '🍕', 'burger': '🍔', 'ramen': '🍜', 'sushi': '🍣',
          // 运动
          'soccer': '⚽', 'basketball': '🏀', 'tennis': '🎾', 'trophy': '🏆',
          'medal': '🏅', 'gold': '🥇', 'silver': '🥈', 'bronze': '🥉',
          // 庆祝
          'party': '🎉', 'gift': '🎁', 'crown': '👑', 'bell': '🔔',
          'balloon': '🎈', 'fireworks': '🎆', 'christmas': '🎄',
        },
      },
      // 工具栏配置
      toolbar: [
        {
          name: 'emoji',
          tip: '表情',
          tipPosition: 's',
        },
        {
          name: 'headings',
          tip: '标题',
          tipPosition: 's',
        },
        {
          name: 'bold',
          tip: '粗体 | Ctrl+B',
          tipPosition: 's',
        },
        {
          name: 'italic',
          tip: '斜体 | Ctrl+I',
          tipPosition: 's',
        },
        {
          name: 'strike',
          tip: '删除线 | Ctrl+D',
          tipPosition: 's',
        },
        {
          name: 'link',
          tip: '链接 | Ctrl+K',
          tipPosition: 's',
        },
        '|',
        {
          name: 'list',
          tip: '无序列表',
          tipPosition: 's',
        },
        {
          name: 'ordered-list',
          tip: '有序列表',
          tipPosition: 's',
        },
        {
          name: 'check',
          tip: '任务列表',
          tipPosition: 's',
        },
        {
          name: 'outdent',
          tip: '减少缩进',
          tipPosition: 's',
        },
        {
          name: 'indent',
          tip: '增加缩进',
          tipPosition: 's',
        },
        '|',
        {
          name: 'quote',
          tip: '引用',
          tipPosition: 's',
        },
        {
          name: 'alerts',
          tip: 'Alerts | Ctrl+Shift+A',
          tipPosition: 's',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm1 12H7v-2h2v2zm0-3H7V4h2v5z"/></svg>',
        },
        {
          name: 'line',
          tip: '分割线',
          tipPosition: 's',
        },
        {
          name: 'code',
          tip: '代码块',
          tipPosition: 's',
        },
        {
          name: 'inline-code',
          tip: '行内代码 | Ctrl+`',
          tipPosition: 's',
        },
        {
          name: 'table',
          tip: '表格 | Ctrl+M\n━━━━━━━━━━━━━\n添加行: Ctrl+=\n删除行: Ctrl+-\n添加列: Ctrl+Shift+=\n删除列: Ctrl+Shift+-\n上插行: Ctrl+Shift+F\n左插列: Ctrl+Shift+G',
          tipPosition: 's',
        },
        '|',
        {
          name: 'undo',
          tip: '撤销 | Ctrl+Z',
          tipPosition: 's',
        },
        {
          name: 'redo',
          tip: '重做 | Ctrl+Shift+Z',
          tipPosition: 's',
        },
        '|',
        {
          name: 'outline',
          tip: '大纲',
          tipPosition: 's',
        },
        {
          name: 'edit-mode',
          tip: '编辑模式',
          tipPosition: 's',
        },
        {
          name: 'preview',
          tip: '预览',
          tipPosition: 's',
        },
        {
          name: 'more',
          toolbar: [
            {
              name: 'export',
              tip: '导出',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            },
            {
              name: 'fullscreen',
              tip: '全屏',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
            },
            {
              name: 'info',
              tip: '关于',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            },
            {
              name: 'help',
              tip: '帮助',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            },
          ],
        },
      ],
      // 编辑器配置
      cache: {
        enable: false,
      },
      counter: {
        enable: false,
      },
      // 图片上传配置
      upload: {
        handler: async (files: File[]): Promise<null> => {
          const imageFiles: File[] = [];
          for (const file of files) {
            if (file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt')) {
              if (!isInPane) {
                const content = await file.text();
                openDocument(`file://${file.name}`, content, false);
              }
            } else {
              imageFiles.push(file);
            }
          }
          
          if (imageFiles.length === 0) {
            return null;
          }
          
          const tauriDetected = await waitForTauri();
          const imageDirectory = useSettingsStore.getState().imageDirectory || 'img';
          const { rootHandle } = useFileStore.getState();
          
          let docDir = '';
          if (path.startsWith('file://')) {
            const fullPath = path.replace('file://', '');
            const lastSlash = Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\'));
            if (lastSlash > 0) {
              docDir = fullPath.substring(0, lastSlash);
            }
          }
          
          if (!docDir) {
            alert('无法确定文档目录，请确保已保存文档。');
            return null;
          }
          
          if (tauriDetected) {
            try {
              const pathSep = platformPathSeparator();
              const imgDirPath = `${docDir}${pathSep}${imageDirectory}`;
              
              const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
              
              try {
                await mkdir(imgDirPath, { recursive: true });
              } catch (e) {
                // 目录已存在，忽略错误
              }
              
              for (const file of imageFiles) {
                const timestamp = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
                const fileName = `${timestamp}_${safeName}`;
                const filePath = `${imgDirPath}${pathSep}${fileName}`;
                
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                await writeFile(filePath, uint8Array);
                
const relativePath = `${imageDirectory}/${fileName}`;
                const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})\n\n`;
                const vditor = vditorRef.current;
                if (vditor) {
                  vditor.insertValue(markdown);
                  
                  setTimeout(() => {
                    const vditorReset = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
                    if (vditorReset) {
                      vditorReset.focus();
                      
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        const range = selection.getRangeAt(0);
                        let cursorRect = range.getBoundingClientRect();
                        
                        if (cursorRect.bottom === 0) {
                          const tempSpan = document.createElement('span');
                          tempSpan.textContent = '\u200B';
                          range.insertNode(tempSpan);
                          cursorRect = tempSpan.getBoundingClientRect();
                          tempSpan.remove();
                        }
                        
                        const containerRect = vditorReset.getBoundingClientRect();
                        const margin = 80;
                        if (cursorRect.bottom > containerRect.bottom - margin) {
                          vditorReset.scrollTop += (cursorRect.bottom - containerRect.bottom + margin);
                        }
                      }
                    }
                  }, 100);
                }
              }
              
              return null;
              
            } catch (e) {
              alert(`保存图片失败: ${e}`);
              return null;
            }
          }
          
          if (!rootHandle) {
            alert('请先打开文件夹后再粘贴图片。');
            return null;
          }
          
          try {
            const { dirHandles, refreshFileTree } = useFileStore.getState();
            let docDirHandle: FileSystemDirectoryHandle = rootHandle!;
            
            if (path.startsWith('file://')) {
              const fullPath = path.replace('file://', '');
              const lastSlash = fullPath.lastIndexOf('/');
              if (lastSlash > 0) {
                const dirPath = fullPath.substring(0, lastSlash);
                const foundHandle = dirHandles.get(dirPath);
                if (foundHandle) {
                  docDirHandle = foundHandle;
                }
              }
            }
            
            const imgDir = await docDirHandle.getDirectoryHandle(imageDirectory, { create: true });
            
            for (const file of imageFiles) {
              const timestamp = Date.now();
              const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
              const fileName = `${timestamp}_${safeName}`;
              const fileHandle = await imgDir.getFileHandle(fileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(file);
              await writable.close();
              
              const relativePath = `${imageDirectory}/${fileName}`;
              const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})\n\n`;
              const vditor = vditorRef.current;
              if (vditor) {
                vditor.insertValue(markdown);
                
                setTimeout(() => {
                  const vditorReset = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
                  if (vditorReset) {
                    vditorReset.focus();
                    
                    const selection = window.getSelection();
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0);
                      let cursorRect = range.getBoundingClientRect();
                      
                      if (cursorRect.bottom === 0) {
                        const tempSpan = document.createElement('span');
                        tempSpan.textContent = '\u200B';
                        range.insertNode(tempSpan);
                        cursorRect = tempSpan.getBoundingClientRect();
                        tempSpan.remove();
                      }
                      
                      const containerRect = vditorReset.getBoundingClientRect();
                      const margin = 80;
                      if (cursorRect.bottom > containerRect.bottom - margin) {
                        vditorReset.scrollTop += (cursorRect.bottom - containerRect.bottom + margin);
                      }
                    }
                  }
                }, 100);
              }
            }
            
            refreshFileTree();
            return null;
            
          } catch (e) {
            alert(`保存图片失败: ${e}`);
            return null;
          }
        },
      },
      // Tab行为配置：由自定义 handler 处理，这里禁用
      tab: '',
      value: contentRef.current,
      // @ts-expect-error Vditor 支持 loading 参数，但类型定义未包含
      loading: '<div class="vditor-loading-container"><div class="vditor-loading-spinner"></div><div class="vditor-loading-text">正在打开文档...</div></div>',
      input: (value: string) => {
        const normalized = value.replace(/^》\s/gm, '> ');
        updateDocument(path, normalized);
        updateWordCountDebounced();
        if (containerRef.current) {
          processAlerts(containerRef.current);
          if (headingFolding) {
            refreshHeadingFolding(containerRef.current);
          }
        }
      },
      after: () => {
        vditorRef.current = vditor;
        isInitializedRef.current = true;
        
        const vditorInternal = (vditor as any).vditor;
        
        // 设置初始字数统计
        const initialValue = vditor.getValue();
        const store = useEditorStore.getState();
        store.setMarkdownLength(initialValue.length);
        store.setWordCount(countPlainText(initialValue));
        
        // 手动启用上标和下标功能（等待官方发布 3.11.3）
        try {
          const lute = (vditor as any).vditor?.lute;
          if (lute) {
            lute.SetSup(true);
            lute.SetSub(true);
            // 重新渲染当前内容
            const currentValue = vditor.getValue();
            vditor.setValue(currentValue);
          }
        } catch (e) {
          console.warn('[Lute] 启用上标/下标失败:', e);
        }
         
// 处理本地图片加载
         processLocalImages(containerRef.current!, path);
          
         processAlerts(containerRef.current!);

         if (headingFolding && containerRef.current) {
           initHeadingFolding(containerRef.current);
         }
         
         // 光标在 alert 标题行时才显示原始语法
        const handleAlertEditingSelection = () => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const container = selection.getRangeAt(0).startContainer;
          const element = container.nodeType === Node.TEXT_NODE ? container.parentElement : container as Element;
          if (!element) return;
          const alertFirstP = element.closest('blockquote.alert > p:first-child');
          
          const irEl = containerRef.current?.querySelector('.vditor-ir .vditor-reset');
          if (irEl) {
            irEl.querySelectorAll('blockquote.alert.alert--editing').forEach(bq => {
              bq.classList.remove('alert--editing');
            });
          }
          
          if (alertFirstP) {
            const bq = alertFirstP.closest('blockquote.alert');
            if (bq) bq.classList.add('alert--editing');
          }
        };
        document.addEventListener('selectionchange', handleAlertEditingSelection);
        (vditorRef.current as any)._alertEditingHandler = handleAlertEditingSelection;
        
        // 大纲与编辑器内容实时联动
        let lastScrolledHeadingId = '';
        
        const getActiveEditor = (): HTMLElement | null => {
          const selectors = [
            '.vditor-ir .vditor-reset',
            '.vditor-sv .vditor-reset',
            '.vditor-wysiwyg .vditor-reset',
          ];
          for (const sel of selectors) {
            const el = containerRef.current?.querySelector(sel) as HTMLElement;
            if (el && el.offsetParent !== null) return el;
          }
          return null;
        };
        
        const applyHeadingHighlight = (currentHeading: Element) => {
          const outline = containerRef.current?.querySelector('.vditor-outline') as HTMLElement;
          if (!outline || outline.style.display === 'none' || outline.offsetParent === null) return;
          
          const headingId = currentHeading.id;
          
          outline.querySelectorAll('.vditor-outline__item--current').forEach(el => {
            el.classList.remove('vditor-outline__item--current');
          });
          
          const targetItem = outline.querySelector(`span[data-target-id="${headingId}"]`) as HTMLElement;
          if (targetItem) {
            targetItem.classList.add('vditor-outline__item--current');
            if (headingId !== lastScrolledHeadingId) {
              lastScrolledHeadingId = headingId;
              const itemLi = targetItem.closest('li') as HTMLElement;
              if (itemLi) {
                itemLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }
            }
          }
        };
        
        // ---- 光标联动：从 Selection API 定位标题 ----
        const updateOutlineByCursor = () => {
          const editorEl = getActiveEditor();
          if (!editorEl) return;
          
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          const range = selection.getRangeAt(0);
          const startNode = range.startContainer;
          
          let heading: Element | null = null;
          if (startNode.nodeType === Node.ELEMENT_NODE) {
            heading = (startNode as Element).closest('h1,h2,h3,h4,h5,h6');
          } else if (startNode.parentElement) {
            heading = startNode.parentElement.closest('h1,h2,h3,h4,h5,h6');
          }
          
          if (!heading) {
            const headings = editorEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
            if (headings.length === 0) return;
            const cursorRect = range.getBoundingClientRect();
            const editorRect = editorEl.getBoundingClientRect();
            const cursorContentTop = cursorRect.top - editorRect.top + editorEl.scrollTop;
            let nearest: Element | null = headings[0];
            for (const h of headings) {
              if ((h as HTMLElement).offsetTop <= cursorContentTop + 2) {
                nearest = h;
              }
            }
            heading = nearest;
          }
          
          if (heading) applyHeadingHighlight(heading);
        };
        
        // ---- 滚动联动：完全基于滚动位置定位标题 ----
        const updateOutlineByScroll = () => {
          const editorEl = getActiveEditor();
          if (!editorEl) return;
          
          const headings = editorEl.querySelectorAll('h1,h2,h3,h4,h5,h6');
          if (headings.length === 0) return;
          
          const scrollTop = editorEl.scrollTop;
          let nearest: Element | null = headings[0];
          for (const h of headings) {
            if ((h as HTMLElement).offsetTop <= scrollTop + 40) {
              nearest = h;
            }
          }
          
          if (nearest) applyHeadingHighlight(nearest);
        };
        
        const debouncedOutlineByCursor = debounce(updateOutlineByCursor, 100);
        const debouncedOutlineByScroll = debounce(updateOutlineByScroll, 50);
        
        document.addEventListener('selectionchange', debouncedOutlineByCursor);
        (vditorRef.current as any)._outlineSyncCursorHandler = debouncedOutlineByCursor;
        
        const scrollTargets = [
          '.vditor-ir .vditor-reset',
          '.vditor-sv .vditor-reset',
          '.vditor-wysiwyg .vditor-reset',
        ];
        for (const sel of scrollTargets) {
          const el = containerRef.current?.querySelector(sel) as HTMLElement;
          if (el) {
            el.addEventListener('scroll', debouncedOutlineByScroll);
          }
        }
        
        // 拦截 alerts 按钮点击
        const alertsBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="alerts"]');
        if (alertsBtn) {
          const handleAlertsClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            setShowAlertsPicker(true);
          };
          alertsBtn.addEventListener('click', handleAlertsClick, true);
          (vditorRef.current as any)._alertsClickHandler = handleAlertsClick;
        }
        
        // 拦截原版emoji按钮点击，使用自定义表情选择器
        const emojiBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="emoji"]');
        if (emojiBtn) {
          // 隐藏原版emoji面板
          const style = document.createElement('style');
          style.textContent = '.vditor-emojis { display: none !important; }';
          document.head.appendChild(style);
          
          // 拦截点击事件
          const handleEmojiClick = (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
            setShowEmojiPicker(true);
          };
          emojiBtn.addEventListener('click', handleEmojiClick, true);
          (vditorRef.current as any)._emojiClickHandler = handleEmojiClick;
          (vditorRef.current as any)._emojiStyleEl = style;
        }
        
        // 拦截indent按钮，处理任务列表全选缩进问题
        const indentBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="indent"]');
        if (indentBtn) {
          const handleIndentClick = (e: Event) => {
            setTimeout(() => {
              const vditor = vditorRef.current;
              if (!vditor) return;
              
              const selection = window.getSelection();
              if (!selection || selection.rangeCount === 0) return;
              
              const range = selection.getRangeAt(0);
              const container = range.commonAncestorContainer;
              const li = container.nodeType === Node.TEXT_NODE 
                ? container.parentElement?.closest('li')
                : (container as Element).closest('li');
              
              if (li) {
                const text = li.textContent || '';
                const hasTaskFormat = /\[([ xX])\]/.test(text);
                
                if (hasTaskFormat && !li.querySelector('input[type="checkbox"]')) {
                  const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, null);
                  let lastTextNode: Text | null = null;
                  let node;
                  while (node = walker.nextNode()) {
                    lastTextNode = node as Text;
                  }
                  
                  if (lastTextNode) {
                    const newRange = document.createRange();
                    newRange.setStart(lastTextNode, lastTextNode.length);
                    newRange.setEnd(lastTextNode, lastTextNode.length);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    
                    vditor.insertValue(' ');
                    
                    setTimeout(() => {
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        const r = sel.getRangeAt(0);
                        r.setStart(r.startContainer, Math.max(0, r.startOffset - 1));
                        r.deleteContents();
                      }
                    }, 100);
                  }
                }
              }
            }, 100);
          };
          indentBtn.addEventListener('click', handleIndentClick, true);
          (vditorRef.current as any)._indentClickHandler = handleIndentClick;
        }
         
          // 为"更多"菜单的子项添加图标
          const moreBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="more"]');
          if (moreBtn) {
            const addIconsToPanel = () => {
              // 查找所有面板（Vditor 的更多菜单面板可能使用不同的 class）
              const panels = containerRef.current?.querySelectorAll('.vditor-panel, .vditor-hint, .vditor-toolbar__popup');
              
              if (panels) {
                panels.forEach((panel) => {
                  const targetButtons = panel.querySelectorAll('button');
                  
                  targetButtons.forEach((btn) => {
                    const dataType = btn.getAttribute('data-type');
                    
                    if ((btn as any)._iconAdded) return;
                    
                    let icon = '';
                    switch (dataType) {
                      case 'export':
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
                        break;
                      case 'fullscreen':
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: middle;"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
                        break;
                      case 'info':
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><path d="M12 16V12M12 8H12.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
                        break;
                      case 'help':
                        icon = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 6px; vertical-align: middle;"><circle cx="12" cy="12" r="10"/><path d="M9 9C9 7.34 10.34 6 12 6C13.66 6 15 7.34 15 9C15 11 12 12 12 12M12 17H12.01" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>';
                        break;
                    }
                    if (icon && btn.textContent) {
                      btn.innerHTML = icon + btn.textContent;
                      (btn as any)._iconAdded = true;
                    }
                  });
                });
              }
            };
            
            // 监听"更多"按钮点击
            const handleMoreClick = () => {
              // 延迟执行，等待面板出现
              setTimeout(addIconsToPanel, 10);
              setTimeout(addIconsToPanel, 100);
              setTimeout(addIconsToPanel, 300);
            };
            
            moreBtn.addEventListener('click', handleMoreClick);
            (vditorRef.current as any)._moreClickHandler = handleMoreClick;
          }
        
        // 恢复预览模式
        const currentVditor = vditor;
        setTimeout(() => {
          if (vditorRef.current !== currentVditor) {
            return;
          }
          try {
            if (savedPreviewMode === 'both') {
              vditorRef.current?.setPreviewMode('both');
            } else if (savedPreviewMode === 'preview') {
              const previewBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="preview"]') as HTMLElement;
              if (previewBtn) {
                previewBtn.click();
              }
            }
          } catch (e) {
            // ignore
          }
        }, 300);
        
        if (savedScrollPosition > 0) {
          setTimeout(() => {
            // 尝试多种选择器找到滚动容器
            let vditorResetEl: HTMLElement | null = null;
            const selectors = [
              '.vditor-ir .vditor-reset',
              '.vditor-sv .vditor-reset', 
              '.vditor-wysiwyg .vditor-reset',
              '.vditor-reset'
            ];
            for (const selector of selectors) {
              const el = containerRef.current?.querySelector(selector) as HTMLElement;
              if (el && el.scrollHeight > el.clientHeight) {
                vditorResetEl = el;
                break;
              }
            }
            if (vditorResetEl) {
              vditorResetEl.scrollTop = savedScrollPosition;
            }
          }, 200);
        }
        
        // 监听滚动位置变化
        let scrollPositionTimeout: ReturnType<typeof setTimeout>;
        const handleScrollPosition = () => {
          clearTimeout(scrollPositionTimeout);
          scrollPositionTimeout = setTimeout(() => {
            // 查找当前可见的滚动容器
            let currentReset: HTMLElement | null = null;
            const selectors = [
              '.vditor-ir .vditor-reset',
              '.vditor-sv .vditor-reset',
              '.vditor-wysiwyg .vditor-reset',
              '.vditor-reset'
            ];
            for (const selector of selectors) {
              const el = containerRef.current?.querySelector(selector) as HTMLElement;
              if (el && el.offsetParent !== null) {
                currentReset = el;
                break;
              }
            }
            if (currentReset) {
              setScrollPositionRef.current(pathRef.current, currentReset.scrollTop);
            }
          }, 200);
        };
        
        // 给所有可能的滚动容器添加监听
        const resetElements = containerRef.current?.querySelectorAll('.vditor-reset');
        resetElements?.forEach(el => {
          el.addEventListener('scroll', handleScrollPosition);
        });
        (vditorRef.current as any)._scrollPositionHandler = handleScrollPosition;
        
        // 监听大纲显示/隐藏
        const outlineElement = containerRef.current?.querySelector('.vditor-outline') as HTMLElement;
        if (outlineElement) {
          const outlineObserver = new MutationObserver(() => {
            const container = containerRef.current;
            if (!container || container.offsetParent === null) return;
            const isVisible = outlineElement.style.display !== 'none' && outlineElement.offsetParent !== null;
            useLayoutStore.getState().setRightSidebarVisible(isVisible);
          });
          outlineObserver.observe(outlineElement, { attributes: true, attributeFilter: ['style', 'class'] });
          (vditorRef.current as any)._outlineObserver = outlineObserver;
          
          // 大纲增强功能：tooltip + 可调整宽度
          const setupOutlineEnhancements = () => {
            const MIN_WIDTH = 180;
            
            const getContentContainer = () => {
              return outlineElement.closest('.vditor-content') as HTMLElement;
            };
            
            const getMaxWidth = () => {
              const content = getContentContainer();
              if (!content) return 400;
              return Math.floor(content.offsetWidth * 0.5);
            };
            
            const applyWidth = (width: number) => {
              const maxWidth = getMaxWidth();
              const finalWidth = Math.max(MIN_WIDTH, Math.min(maxWidth, width));
              outlineElement.style.width = `${finalWidth}px`;
              outlineElement.style.flexBasis = `${finalWidth}px`;
            };
            
            applyWidth(useLayoutStore.getState().rightSidebarWidth);
            
            const handleOutlineMouseOver = (e: MouseEvent) => {
              const target = (e.target as HTMLElement).closest('li > span > span') as HTMLElement | null;
              if (target && target.textContent) {
                target.setAttribute('title', target.textContent);
              }
            };
            outlineElement.addEventListener('mouseover', handleOutlineMouseOver);
            (vditorRef.current as any)._outlineMouseOverHandler = handleOutlineMouseOver;
            (vditorRef.current as any)._outlineMouseOverTarget = outlineElement;
            
            let isDragging = false;
            let startX = 0;
            let startWidth = 0;
            
            const handleMouseDown = (e: MouseEvent) => {
              if (e.button !== 0) return;
              const rect = outlineElement.getBoundingClientRect();
              const edgeWidth = 6;
              if (e.clientX < rect.left || e.clientX > rect.left + edgeWidth) return;
              if (e.clientY < rect.top || e.clientY > rect.bottom) return;
              
              isDragging = true;
              startX = e.clientX;
              startWidth = outlineElement.offsetWidth;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
              outlineElement.classList.add('outline-resizing');
              e.preventDefault();
            };
            
            const handleMouseMove = (e: MouseEvent) => {
              if (isDragging) {
                const diff = startX - e.clientX;
                const newWidth = startWidth + diff;
                applyWidth(newWidth);
              } else {
                const rect = outlineElement.getBoundingClientRect();
                const edgeWidth = 6;
                if (e.clientX >= rect.left && e.clientX <= rect.left + edgeWidth &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                  outlineElement.style.cursor = 'col-resize';
                } else {
                  outlineElement.style.cursor = '';
                }
              }
            };
            
            const handleMouseUp = () => {
              if (!isDragging) return;
              isDragging = false;
              document.body.style.cursor = '';
              document.body.style.userSelect = '';
              outlineElement.classList.remove('outline-resizing');
              const currentWidth = outlineElement.offsetWidth;
              useLayoutStore.getState().setRightSidebarWidth(currentWidth);
            };
            
            document.addEventListener('mousedown', handleMouseDown);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            
            (vditorRef.current as any)._outlineResizeMouseDown = handleMouseDown;
            (vditorRef.current as any)._outlineResizeMouseMove = handleMouseMove;
            (vditorRef.current as any)._outlineResizeMouseUp = handleMouseUp;
          };
          
          setupOutlineEnhancements();
        }
        
        // 监听编辑模式切换 - 监听三个编辑区域的display变化
        let prevMode: EditorMode | null = null;
        let lastOutlineFixTime = 0;
        const checkEditorMode = () => {
          const irElement = containerRef.current?.querySelector('.vditor-ir') as HTMLElement | null;
          const svElement = containerRef.current?.querySelector('.vditor-sv') as HTMLElement | null;
          const wysiwygElement = containerRef.current?.querySelector('.vditor-wysiwyg') as HTMLElement | null;
          
          let currentMode: EditorMode = 'ir';
          if (svElement && svElement.style.display !== 'none') {
            currentMode = 'sv';
          } else if (wysiwygElement && wysiwygElement.style.display !== 'none') {
            currentMode = 'wysiwyg';
          } else if (irElement && irElement.style.display !== 'none') {
            currentMode = 'ir';
          }
          
          setEditorModeRef.current(pathRef.current, currentMode);

          const switchedToIR = prevMode !== null && prevMode !== 'ir' && currentMode === 'ir';
          prevMode = currentMode;

          if (switchedToIR) {
            const now = Date.now();
            if (now - lastOutlineFixTime > 500) {
              lastOutlineFixTime = now;

              const restoreWidth = () => {
                const outline = containerRef.current?.querySelector('.vditor-outline') as HTMLElement;
                if (!outline) return;
                const w = useLayoutStore.getState().rightSidebarWidth;
                const content = outline.closest('.vditor-content') as HTMLElement;
                const maxW = content ? Math.floor(content.offsetWidth * 0.5) : 400;
                const fw = Math.max(180, Math.min(maxW, w));
                outline.style.width = `${fw}px`;
                outline.style.flexBasis = `${fw}px`;
              };

              setTimeout(() => {
                const outline = containerRef.current?.querySelector('.vditor-outline') as HTMLElement;
                if (!outline || outline.style.display === 'none') return;

                if (outline.querySelector('li')) {
                  restoreWidth();
                  return;
                }

                const vditorInternal = (vditorRef.current as any)?.vditor;
                if (vditorInternal?.outline?.render) {
                  try { vditorInternal.outline.render(vditorInternal); } catch (e) { }
                }

                setTimeout(() => {
                  const outlineCheck = containerRef.current?.querySelector('.vditor-outline') as HTMLElement;
                  if (!outlineCheck || outlineCheck.querySelector('li')) {
                    restoreWidth();
                    return;
                  }

                  const outlineBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="outline"]') as HTMLElement;
                  if (outlineBtn) {
                    outlineBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                    outlineBtn.click();
                    setTimeout(() => {
                      outlineBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                      outlineBtn.click();
                      setTimeout(restoreWidth, 200);
                    }, 200);
                  }
                }, 200);
              }, 2000);
            }
          }

          if (containerRef.current && headingFolding) {
            destroyHeadingFolding(containerRef.current);
            if (currentMode !== 'sv') {
              const tryInit = (attempts: number) => {
                if (attempts > 10) return;
                if (containerRef.current) {
                  const editorContent = containerRef.current.querySelector(
                    currentMode === 'ir' ? '.vditor-ir .vditor-reset' : '.vditor-wysiwyg .vditor-reset'
                  ) as HTMLElement;
                  if (editorContent && editorContent.querySelector('h1, h2, h3, h4, h5, h6')) {
                    initHeadingFolding(containerRef.current);
                  } else {
                    setTimeout(() => tryInit(attempts + 1), 100);
                  }
                }
              };
              setTimeout(() => tryInit(0), 100);
            }
          }
        };
        
        // 监听三个编辑区域的style变化
        const irElement = containerRef.current?.querySelector('.vditor-ir');
        const svElement = containerRef.current?.querySelector('.vditor-sv');
        const wysiwygElement = containerRef.current?.querySelector('.vditor-wysiwyg');
        
        const modeObserver = new MutationObserver(() => {
          checkEditorMode();
        });
        
        if (irElement) {
          modeObserver.observe(irElement, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        if (svElement) {
          modeObserver.observe(svElement, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        if (wysiwygElement) {
          modeObserver.observe(wysiwygElement, { attributes: true, attributeFilter: ['style', 'class'] });
        }
        (vditorRef.current as any)._modeObserver = modeObserver;
        
        // 监听预览模式变化
        const previewElement = containerRef.current?.querySelector('.vditor-preview') as HTMLElement;
        const irElementForPreview = containerRef.current?.querySelector('.vditor-ir') as HTMLElement;
        const svElementForPreview = containerRef.current?.querySelector('.vditor-sv') as HTMLElement;
        const wysiwygElementForPreview = containerRef.current?.querySelector('.vditor-wysiwyg') as HTMLElement;
        
        if (previewElement) {
          const previewObserver = new MutationObserver(() => {
            const vditorInternal = (vditorRef.current as any)?.vditor;
            const internalPreviewMode = vditorInternal?.currentPreviewMode;
            
            // 检测预览区域和编辑器区域的显示状态
            const previewVisible = previewElement.style.display !== 'none' && previewElement.offsetParent !== null;
            
            // 检查编辑器区域是否可见
            const irVisible = irElementForPreview ? (irElementForPreview.style.display !== 'none' && irElementForPreview.offsetParent !== null) : false;
            const svVisible = svElementForPreview ? (svElementForPreview.style.display !== 'none' && svElementForPreview.offsetParent !== null) : false;
            const wysiwygVisible = wysiwygElementForPreview ? (wysiwygElementForPreview.style.display !== 'none' && wysiwygElementForPreview.offsetParent !== null) : false;
            const editorVisible = irVisible || svVisible || wysiwygVisible;
            
            // 根据显示状态判断模式
            let currentPreviewMode: PreviewMode = 'editor';
            if (previewVisible && editorVisible) {
              currentPreviewMode = 'both';
            } else if (previewVisible && !editorVisible) {
              currentPreviewMode = 'preview';
            }
            
            setPreviewModeRef.current(pathRef.current, currentPreviewMode);
          });
          previewObserver.observe(previewElement, { attributes: true, attributeFilter: ['style', 'class'] });
          if (irElementForPreview) {
            previewObserver.observe(irElementForPreview, { attributes: true, attributeFilter: ['style', 'class'] });
          }
          if (svElementForPreview) {
            previewObserver.observe(svElementForPreview, { attributes: true, attributeFilter: ['style', 'class'] });
          }
          if (wysiwygElementForPreview) {
            previewObserver.observe(wysiwygElementForPreview, { attributes: true, attributeFilter: ['style', 'class'] });
          }
          (vditorRef.current as any)._previewModeObserver = previewObserver;
        }
        
        // 链接点击拦截处理 - 绑定到vditor-reset元素
        const handleLinkClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          
          let link = target.closest('a');
          let href: string | null = null;
          let linkText: string | null = null;
          
          if (link) {
            href = link.getAttribute('href');
            linkText = link.textContent;
          } else {
            const irLink = target.closest('.vditor-ir__link');
            if (irLink) {
              linkText = irLink.textContent;
              
              let parent = irLink.parentElement;
              let found = false;
              
              for (let i = 0; i < 5 && parent && !found; i++) {
                const urlElement = parent.querySelector('.vditor-ir__url') as HTMLElement;
                if (urlElement) {
                  href = urlElement.textContent;
                  found = true;
                  break;
                }
                
                const bracketElement = parent.querySelector('.vditor-ir__bracket');
                if (bracketElement) {
                  const nextSibling = bracketElement.nextElementSibling;
                  if (nextSibling && nextSibling.classList.contains('vditor-ir__url')) {
                    href = nextSibling.textContent;
                    found = true;
                    break;
                  }
                }
                
                parent = parent.parentElement;
              }
              
              if (!href && linkText) {
                const content = vditor.getValue();
                const linkRegex = new RegExp(`\\[${linkText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(([^)]+)\\)`, 'g');
                const matches = [...content.matchAll(linkRegex)];
                if (matches.length > 0) {
                  href = matches[0][1];
                }
              }
            }
          }
          
          if (!href) {
            return;
          }
          
          href = href.replace(/[()]/g, '').trim();
          
          if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
            return;
          }
          
          if (href.startsWith('#')) {
            return;
          }
          
          if (!isLocalMdFile(href)) {
            return;
          }
          
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          const embedContainer = target.closest('.embed-container');
          if (embedContainer) {
            const embedPath = embedContainer.getAttribute('data-embed-path');
            if (embedPath && isLocalMdFile(embedPath)) {
              handleLocalMdLinkClick(embedPath);
              return;
            }
          }
          
          handleLocalMdLinkClick(href);
        };
        
        const vditorResetForLink = containerRef.current?.querySelector('.vditor-ir .vditor-reset');
        const vditorPreviewEl = containerRef.current?.querySelector('.vditor-preview');
        
        if (vditorResetForLink) {
          vditorResetForLink.addEventListener('click', handleLinkClick as unknown as EventListener, true);
        }
        if (vditorPreviewEl) {
          vditorPreviewEl.addEventListener('click', handleLinkClick as unknown as EventListener, true);
        }
        
        (vditorRef.current as any)._linkClickHandler = handleLinkClick;
        (vditorRef.current as any)._linkClickReset = vditorResetForLink;
        (vditorRef.current as any)._linkClickPreview = vditorPreviewEl;
        
        // 处理预览模式的嵌入内容
        const currentPath = path;
        const maxEmbedCount = embedMaxCount;
        const currentRootPath = getRootPath();
        let isProcessing = false;
        let processedInCurrentBatch = 0; // 当前批次已处理的数量
        
        const processEmbedPlaceholders = async () => {
          if (isProcessing) return;
          isProcessing = true;
          processedInCurrentBatch = 0;
          
          try {
            const previewElements = containerRef.current?.querySelectorAll('.vditor-preview, .vditor-sv__preview, .vditor-ir__preview');
            if (!previewElements || previewElements.length === 0) {
              return;
            }
            
            const mdContent = vditor.getValue();
            const mdEmbedLinks: Array<{ url: string; displayText: string }> = [];
            
            // 使用新语法的正则：[[xxx]](doc.md) 或 [[](doc.md)
            const linkRegex = /\[\[([^\]]*?)\]\]\(([^)]+)\)/gi;
            let match;
            while ((match = linkRegex.exec(mdContent)) !== null) {
              const displayText = match[1]?.trim() || '';
              const url = match[2];
              if (isLocalMdFile(url)) {
                mdEmbedLinks.push({ url, displayText });
              }
            }
            
            // 更新已存在的嵌入容器的标题
            for (const previewEl of previewElements) {
              if ((previewEl as HTMLElement).style.display === 'none') continue;
              
              const embedContainers = previewEl.querySelectorAll('.embed-container');
              
              for (const container of embedContainers) {
                const embedPath = container.getAttribute('data-embed-path');
                if (!embedPath) continue;
                
                const linkInfo = mdEmbedLinks.find(l => {
                  const resolved = resolveDocPath(l.url, currentPath, currentRootPath).replace(/\\/g, '/');
                  return resolved === embedPath.replace(/\\/g, '/') || l.url === embedPath;
                });
                
                if (linkInfo) {
                  const titleEl = container.querySelector('.embed-title');
                  if (titleEl) {
                    const newTitle = linkInfo.displayText || getFileDisplayName(embedPath);
                    if (titleEl.textContent !== newTitle) {
                      titleEl.textContent = newTitle;
                    }
                  }
                }
              }
            }
            
            // 收集所有待处理的链接，并立即标记
            const pendingLinks: Array<{ link: HTMLAnchorElement; linkInfo: { url: string; displayText: string } }> = [];
            
            for (const previewEl of previewElements) {
              if ((previewEl as HTMLElement).style.display === 'none') continue;
              
              const allLinks = Array.from(previewEl.querySelectorAll('a'));
              
              for (const link of allLinks) {
                if (!link.parentElement) continue;
                if ((link as any)._embedProcessed) continue;
                
                const href = link.getAttribute('href') || '';
                const linkText = link.textContent?.trim() || '';
                
                // 检查链接文本是否是 [xxx] 格式（嵌入语法）
                if (!linkText.startsWith('[') || !linkText.endsWith(']')) continue;
                
                const linkInfo = mdEmbedLinks.find(l => l.url === href);
                if (!linkInfo) continue;
                
                // 立即标记为已处理
                (link as any)._embedProcessed = true;
                pendingLinks.push({ link, linkInfo });
              }
            }
            
            // 同步顺序处理每个链接
            for (const { link, linkInfo } of pendingLinks) {
              if (!link.parentElement) continue;
              
              // 检查数量限制
              if (processedInCurrentBatch >= maxEmbedCount) {
                link.outerHTML = createEmbedWarning(`嵌入文档数量超过限制 (最大${maxEmbedCount}个)`);
                continue;
              }
              
              const href = link.getAttribute('href') || '';
              const resolvedPath = resolveDocPath(href, currentPath, currentRootPath);
              const normalizedResolvedPath = resolvedPath.replace(/\\/g, '/');
              const currentDocFullPath = currentPath.replace(/^file:\/\//, '').replace(/\\/g, '/');
              
              if (normalizedResolvedPath === currentDocFullPath || 
                  currentDocFullPath.endsWith('/' + normalizedResolvedPath)) {
                link.outerHTML = createEmbedWarning(`检测到循环引用: 不能嵌入自身`, resolvedPath);
                continue;
              }
              
              // 立即增加计数
              processedInCurrentBatch++;
              
              const result = await readMdFileContent(resolvedPath);
              
              if (!link.parentElement) {
                continue;
              }
              
              if (result.error) {
                link.outerHTML = createEmbedWarning(result.error, resolvedPath);
              } else {
                const tempDiv = document.createElement('div');
                tempDiv.className = 'embed-content vditor-reset';
                
                await new Promise<void>((resolve) => {
                  Vditor.preview(tempDiv, result.content || '', {
      cdn: VDITOR_CDN,
                    mode: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
                    markdown: {
                      codeBlockPreview: true,
                      mathBlockPreview: true,
                      toc: false,
                      mark: true,
                    },
                    after: () => resolve(),
                  });
                  setTimeout(resolve, 500);
                });
                
                if (!link.parentElement) {
                  continue;
                }
                
                const embedHtml = createEmbedContainer(resolvedPath, tempDiv.innerHTML, linkInfo.displayText);
                link.outerHTML = embedHtml;
              }
            }
          } finally {
            isProcessing = false;
          }
        };
        
        setTimeout(() => {
          processEmbedPlaceholders();
        }, 300);
        
        const previewObserver = new MutationObserver(() => {
          processEmbedPlaceholders();
        });
        
        if (containerRef.current) {
          previewObserver.observe(containerRef.current, {
            childList: true,
            subtree: true,
          });
        }
        (vditorRef.current as any)._previewObserver = previewObserver;
        
        // TOC 目录点击跳转处理（使用事件委托，绑定到容器）
        const handleTocClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          
          const tocContainer = target.closest('.vditor-toc');
          if (!tocContainer) return;
          
          const tocItem = target.closest('li');
          if (!tocItem) return;
          
          const link = tocItem.querySelector('a, span[data-target-id]') as HTMLElement;
          if (!link) return;
          
          e.preventDefault();
          e.stopPropagation();
          
          let headingId: string | null = null;
          if (link.tagName === 'A') {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
              headingId = href.substring(1);
            }
          } else {
            headingId = link.getAttribute('data-target-id');
          }
          
          if (headingId) {
            const vditorReset = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
            if (!vditorReset) return;
            
            // 去掉 ir- 前缀
            const cleanHeadingId = headingId.replace(/^ir-/, '');
            
            let heading = vditorReset.querySelector(`[id="${headingId}"]`) as HTMLElement;
            
            if (!heading) {
              // 尝试查找匹配的标题
              const headings = vditorReset.querySelectorAll('h1, h2, h3, h4, h5, h6');
              for (const h of headings) {
                const hText = h.textContent?.trim().replace(/^#+\s*/, '');
                if (hText === cleanHeadingId || hText === decodeURIComponent(cleanHeadingId)) {
                  heading = h as HTMLElement;
                  break;
                }
              }
            }
            
            if (heading) {
              // 大文档使用即时滚动，小文档使用平滑滚动
              const isLargeDoc = vditorReset.scrollHeight > 50000;
              vditorReset.scrollTo({
                top: heading.offsetTop - 20,
                behavior: isLargeDoc ? 'instant' : 'smooth'
              });
            }
          }
        };
        
        // 绑定到整个编辑器容器（捕获阶段）
        if (containerRef.current) {
          containerRef.current.addEventListener('click', handleTocClick as EventListener, true);
          (vditorRef.current as any)._tocClickHandler = handleTocClick;
          (vditorRef.current as any)._tocClickTarget = containerRef.current;
        }
        
        // 渲染 Mermaid 图表
        const renderMermaid = () => {
          const mermaidElements = containerRef.current?.querySelectorAll('.vditor-ir pre.vditor-reset .mermaid');
          if (mermaidElements && mermaidElements.length > 0) {
            try {
              const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'classic';
              Vditor.mermaidRender(containerRef.current!, VDITOR_CDN, theme);
            } catch (e) {
              console.warn('[Mermaid] 渲染失败:', e);
            }
          }
        };
        
        // 渲染 PlantUML 图表
        const renderPlantUML = () => {
          const plantumlElements = containerRef.current?.querySelectorAll('.vditor-ir pre.vditor-reset .language-plantuml');
          if (plantumlElements && plantumlElements.length > 0) {
            try {
              Vditor.plantumlRender(containerRef.current!, VDITOR_CDN);
            } catch (e) {
              console.warn('[PlantUML] 渲染失败:', e);
            }
          }
        };
        
        // 初始渲染
        setTimeout(renderMermaid, 100);
        setTimeout(renderPlantUML, 100);
        
        // 检测光标是否在行首
        const isAtLineStart = (): boolean => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return false;
          
          const range = selection.getRangeAt(0);
          const container = range.startContainer;
          
          // 如果是文本节点，检查偏移量
          if (container.nodeType === Node.TEXT_NODE) {
            const text = container.textContent || '';
            const offset = range.startOffset;
            
            // 检查光标前的文本是否全是空白或为空
            const textBeforeCursor = text.substring(0, offset);
            if (offset === 0 || /^\s*$/.test(textBeforeCursor)) {
              // 还需要检查是否在行首（父元素是段落开头）
              const parent = container.parentElement;
              if (parent) {
                // 获取光标所在行的文本
                const lineText = parent.textContent || '';
                const cursorPosInLine = offset + (parent.firstChild === container ? 0 : 0);
                
                // 如果光标前的内容都是空白，则认为在行首
                const beforeCursor = lineText.substring(0, cursorPosInLine);
                if (/^\s*$/.test(beforeCursor) || cursorPosInLine === 0) {
                  return true;
                }
              }
            }
          }
          
          return false;
        };
        
        // 记录 Tab 按下时间，用于检测 Tab 触发的代码块
        let lastTabTime = 0;
        let isTabPressed = false;
        
        // 在编辑器容器上拦截 Tab 键
        const tabKeydownHandler = (e: KeyboardEvent) => {
          if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              
              // 检查是否在表格内
              const cell = range.startContainer.parentElement?.closest('td, th');
              if (cell) {
                return;
              }
              
              // 检查是否在列表内 - 匹配 UL/OL/LI 标签
              const listContainer = range.startContainer.parentElement?.closest('ul, ol, li');
              if (listContainer) {
                return;
              }
            }
            
            // 不在表格或列表内，插入缩进
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            isTabPressed = true;
            lastTabTime = Date.now();
            
            if (selection && selection.rangeCount > 0) {
              const range = selection.getRangeAt(0);
              const textNode = document.createTextNode('　　');
              range.insertNode(textNode);
              range.setStartAfter(textNode);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              
              // 触发 input 事件让 Vditor 知道内容变化了
              containerRef.current?.querySelector('.vditor-reset')?.dispatchEvent(new InputEvent('input', { bubbles: true }));
            }
          }
        };
        
        containerRef.current?.addEventListener('keydown', tabKeydownHandler, true);
        (vditorRef.current as any)._tabKeydownHandler = tabKeydownHandler;
        
        // Mermaid 渲染防抖
        let mermaidDebounceTimer: number | null = null;
        const debouncedRenderMermaid = () => {
          if (mermaidDebounceTimer) {
            clearTimeout(mermaidDebounceTimer);
          }
          mermaidDebounceTimer = window.setTimeout(() => {
            const mermaidElements = containerRef.current?.querySelectorAll('.vditor-ir .vditor-reset .mermaid');
            if (mermaidElements && mermaidElements.length > 0) {
              try {
                const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'classic';
                Vditor.mermaidRender(containerRef.current!, VDITOR_CDN, theme);
              } catch (e) {
                console.warn('[Mermaid] 渲染失败:', e);
              }
            }
          }, 300);
        };
        
        // PlantUML 渲染防抖
        let plantumlDebounceTimer: number | null = null;
        const debouncedRenderPlantUML = () => {
          if (plantumlDebounceTimer) {
            clearTimeout(plantumlDebounceTimer);
          }
          plantumlDebounceTimer = window.setTimeout(() => {
            const plantumlElements = containerRef.current?.querySelectorAll('.vditor-ir .vditor-reset .language-plantuml');
            if (plantumlElements && plantumlElements.length > 0) {
              try {
                Vditor.plantumlRender(containerRef.current!, VDITOR_CDN);
              } catch (e) {
                console.warn('[PlantUML] 渲染失败:', e);
              }
            }
          }, 300);
        };
        
        // MutationObserver 回调处理函数
        const handleMutationCallback = (mutations: MutationRecord[]) => {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
              // 处理图片
              if (node instanceof HTMLImageElement) {
                handleLocalImage(node, path);
              } else if (node instanceof HTMLElement) {
                const imgs = node.querySelectorAll('img');
                imgs.forEach(img => handleLocalImage(img, path));
                
                // 检测 Mermaid 代码块
                if (node.classList?.contains('mermaid') || 
                    node.querySelector?.('.mermaid')) {
                  debouncedRenderMermaid();
                }
                
                // 检测 PlantUML 代码块
                if (node.classList?.contains('language-plantuml') || 
                    node.querySelector?.('.language-plantuml')) {
                  debouncedRenderPlantUML();
                }
                
                // 检测是否是 Tab 触发的代码块
                if (node.getAttribute?.('data-type') === 'code-block' || 
                    node.querySelector?.('[data-type="code-block"]')) {
                  const now = Date.now();
                  // 如果在 Tab 按下后 100ms 内插入的代码块，认为是 Tab 触发的
                    if (now - lastTabTime < 100) {
                      node.remove();
                      vditorRef.current?.insertValue('　　');
                    }
                }
                
                // 处理 Alerts
                if (node.nodeName === 'BLOCKQUOTE' || node.querySelector?.('blockquote')) {
                  processAlerts(containerRef.current!);
                }
              }
            }
          }
        };
        
        // 中文》引用：当用户在行首输入 》 后按空格，替换为 > 并触发 Vditor 渲染
        const irPreEl = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
        if (irPreEl) {
          const handleCnQuoteKeydown = (e: KeyboardEvent) => {
            if (e.key !== ' ') return;
            
            const selection = window.getSelection();
            if (!selection || selection.rangeCount === 0) return;
            
            const range = selection.getRangeAt(0);
            if (!range.collapsed) return;
            
            const textNode = range.startContainer;
            if (textNode.nodeType !== Node.TEXT_NODE) return;
            
            const text = textNode.textContent || '';
            const pos = range.startOffset;
            
            if (pos < 1 || text[pos - 1] !== '》') return;
            
            const beforeCnQuote = text.slice(0, pos - 1).trim();
            if (beforeCnQuote !== '') return;
            
            e.preventDefault();
            e.stopPropagation();
            
            textNode.textContent = text.slice(0, pos - 1) + text.slice(pos);
            range.setStart(textNode, pos - 1);
            range.collapse(true);
            
            vditorRef.current?.insertValue('> ');
          };
          
          irPreEl.addEventListener('keydown', handleCnQuoteKeydown, true);
          (vditorRef.current as any)._cnQuoteBeforeInput = handleCnQuoteKeydown;
          (vditorRef.current as any)._cnQuotePreEl = irPreEl;
        }
        
        // 监听DOM变化，处理新插入的图片和代码块
        const imageObserver = new MutationObserver(handleMutationCallback);
        
        imageObserver.observe(containerRef.current!, {
          childList: true,
          subtree: true,
        });
        
        // 自动滚动逻辑 - 类似 VS Code
        // 关键：滚动元素是 .vditor-reset，不是 .vditor-content
        const vditorResetForScroll = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
        const contentEl = containerRef.current?.querySelector('.vditor-content') as HTMLElement;
        
        let isUserInput = false;
        
        const handleScroll = () => {
          if (!vditorResetForScroll || !contentEl || !isUserInput) return;
          
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) return;
          
          const range = selection.getRangeAt(0);
          let cursorRect = range.getBoundingClientRect();
          
          if (cursorRect.bottom === 0 && range.collapsed) {
            const tempSpan = document.createElement('span');
            tempSpan.textContent = '\u200B';
            range.insertNode(tempSpan);
            cursorRect = tempSpan.getBoundingClientRect();
            tempSpan.remove();
          }
          
          if (cursorRect.bottom === 0) return;
          
          const containerRect = contentEl.getBoundingClientRect();
          const currentDistanceFromBottom = containerRect.bottom - cursorRect.bottom;
          
          const fixedDistanceFromBottom = 120;
          
          if (currentDistanceFromBottom < fixedDistanceFromBottom) {
            const scrollAmount = fixedDistanceFromBottom - currentDistanceFromBottom;
            vditorResetForScroll.scrollTop += scrollAmount;
          }
          
          isUserInput = false;
        };
        
        // 监听键盘事件（用户输入时触发）
        const handleKeyDown = (e: KeyboardEvent) => {
          // 只在用户输入字符时标记
          if (e.key.length === 1 || e.key === 'Enter') {
            isUserInput = true;
            requestAnimationFrame(() => handleScroll());
          }
        };
        
        if (vditorResetForScroll) {
          vditorResetForScroll.addEventListener('keydown', handleKeyDown as EventListener);
        }
        
        // 保存引用以便清理
        (vditorRef.current as any)._imageObserver = imageObserver;
        (vditorRef.current as any)._handleKeyDown = handleKeyDown;
        (vditorRef.current as any)._vditorReset = vditorResetForScroll;
      },
    });

    return () => {
      if (vditorRef.current) {
        const imageObserver = (vditorRef.current as any)._imageObserver;
        const handleKeyDown = (vditorRef.current as any)._handleKeyDown;
        const vditorReset = (vditorRef.current as any)._vditorReset;
        const tabKeydownHandler = (vditorRef.current as any)._tabKeydownHandler;
        const tocClickHandler = (vditorRef.current as any)._tocClickHandler;
        const tocClickTarget = (vditorRef.current as any)._tocClickTarget;
        const linkClickHandler = (vditorRef.current as any)._linkClickHandler;
        const linkClickReset = (vditorRef.current as any)._linkClickReset;
        const linkClickPreview = (vditorRef.current as any)._linkClickPreview;
        const previewObserver = (vditorRef.current as any)._previewObserver;
        const outlineObserver = (vditorRef.current as any)._outlineObserver;
        const outlineMouseOverHandler = (vditorRef.current as any)._outlineMouseOverHandler;
        const outlineMouseOverTarget = (vditorRef.current as any)._outlineMouseOverTarget;
        const outlineResizeMouseDown = (vditorRef.current as any)._outlineResizeMouseDown;
        const outlineResizeMouseMove = (vditorRef.current as any)._outlineResizeMouseMove;
        const outlineResizeMouseUp = (vditorRef.current as any)._outlineResizeMouseUp;
        const modeObserver = (vditorRef.current as any)._modeObserver;
        const previewModeObserver = (vditorRef.current as any)._previewModeObserver;
        
        if (imageObserver) imageObserver.disconnect();
        if (previewObserver) previewObserver.disconnect();
        if (outlineObserver) outlineObserver.disconnect();
        if (outlineMouseOverHandler && outlineMouseOverTarget) {
          outlineMouseOverTarget.removeEventListener('mouseover', outlineMouseOverHandler);
        }
        if (outlineResizeMouseDown) {
          document.removeEventListener('mousedown', outlineResizeMouseDown);
        }
        if (outlineResizeMouseMove) {
          document.removeEventListener('mousemove', outlineResizeMouseMove);
        }
        if (outlineResizeMouseUp) {
          document.removeEventListener('mouseup', outlineResizeMouseUp);
        }
        if (modeObserver) modeObserver.disconnect();
        if (previewModeObserver) previewModeObserver.disconnect();
        
        // 移除滚动监听
        const scrollPositionHandler = (vditorRef.current as any)._scrollPositionHandler;
        if (scrollPositionHandler) {
          const resetEls = containerRef.current?.querySelectorAll('.vditor-reset');
          resetEls?.forEach(el => {
            el.removeEventListener('scroll', scrollPositionHandler);
          });
        }
        if (handleKeyDown && vditorReset) {
          vditorReset.removeEventListener('keydown', handleKeyDown);
        }
        if (tabKeydownHandler && containerRef.current) {
          containerRef.current.removeEventListener('keydown', tabKeydownHandler, true);
        }
        if (tocClickHandler && tocClickTarget) {
          tocClickTarget.removeEventListener('click', tocClickHandler, true);
        }
        if (linkClickHandler) {
          if (linkClickReset) {
            linkClickReset.removeEventListener('click', linkClickHandler as EventListener, true);
          }
          if (linkClickPreview) {
            linkClickPreview.removeEventListener('click', linkClickHandler as EventListener, true);
          }
        }
        processedEmbedsRef.current.clear();
        
        // 移除 alert 编辑状态监听（在 destroy 前，vditor 仍存在）
        const alertEditingHandler = (vditorRef.current as any)?._alertEditingHandler;
        if (alertEditingHandler) {
          document.removeEventListener('selectionchange', alertEditingHandler);
        }
        
        // 移除中文》引用拦截
        const cnQuoteBeforeInput = (vditorRef.current as any)?._cnQuoteBeforeInput;
        const cnQuotePreEl = (vditorRef.current as any)?._cnQuotePreEl;
        if (cnQuoteBeforeInput && cnQuotePreEl) {
          cnQuotePreEl.removeEventListener('keydown', cnQuoteBeforeInput, true);
        }
        
        if (containerRef.current) {
          destroyHeadingFolding(containerRef.current);
        }
        
        vditorRef.current.destroy();
        vditorRef.current = null;
        isInitializedRef.current = false;
        currentPathRef.current = '';
        contentRef.current = '';
      }
    };
  }, [path, initKey, updateDocument, saveToFile]);

  // 监听主题变化
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          const themeAttr = document.documentElement.getAttribute('data-theme') as ThemeId | null;
          const isDark = themeAttr ? THEMES[themeAttr]?.group === 'dark' : false;
          if (vditorRef.current) {
            vditorRef.current.setTheme(isDark ? 'dark' : 'classic');
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current || !containerRef.current) return;
    if (headingFolding) {
      initHeadingFolding(containerRef.current);
    } else {
      destroyHeadingFolding(containerRef.current);
    }
  }, [headingFolding]);

  return (
    <div className={`vditor-container editor-width-${editorWidth}`} style={{ position: 'relative' }}>
      <div ref={containerRef} className="vditor-wrapper" />
      {/* 表情选择器弹窗 */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={(emoji) => {
            if (vditorRef.current) {
              vditorRef.current.insertValue(emoji + ' ');
            }
          }}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
      {/* 查找替换弹窗 */}
      {showReplaceDialog && (
        <ReplaceDialog
          isOpen={showReplaceDialog}
          onClose={() => setShowReplaceDialog(false)}
          vditor={vditorRef.current}
        />
      )}
      {/* Alerts 选择器弹窗 */}
      {showAlertsPicker && (
        <AlertsPicker
          onSelect={(type) => {
            if (vditorRef.current) {
              const markdown = `> [!${type}]\n> `;
              vditorRef.current.insertValue(markdown);
              // 插入后将光标移到第二行（框内）
              setTimeout(() => {
                const preEl = containerRef.current?.querySelector('.vditor-ir .vditor-reset');
                if (!preEl) return;
                const bqs = preEl.querySelectorAll('blockquote.alert');
                const bq = bqs[bqs.length - 1];
                if (!bq) return;
                const lastP = bq.querySelector('p:last-child');
                if (!lastP) return;
                const range = document.createRange();
                range.selectNodeContents(lastP);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                // 触发 Vditor input 处理
                preEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
              }, 80);
            }
          }}
          onClose={() => setShowAlertsPicker(false)}
        />
      )}
    </div>
  );
});

VditorEditor.displayName = 'VditorEditor';

export default VditorEditor;
