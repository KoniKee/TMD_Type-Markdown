import React, { useRef, useEffect, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './vditor-styles.css';
import { useEditorStore, useFileStore, useSettingsStore } from '../../stores';
import { useSaveToFile } from '../../hooks/useAutoSave';
import { isTauriCached, waitForTauri } from '../../utils/platform';

interface VditorEditorProps {
  path: string;
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
      
      const imagePath = `${docDir}\\${cleanSrc}`;
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
    console.warn('[ImageLoader] 无法加载本地图片:', imageSrc, err);
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
      console.log('[ImageLoader] 图片已加载:', src);
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

export const VditorEditor = React.memo<VditorEditorProps>(({ path }) => {
  const vditorRef = useRef<Vditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateDocument = useEditorStore((state) => state.updateDocument);
  const saveToFile = useSaveToFile();
  const isInitializedRef = useRef(false);
  const currentPathRef = useRef<string>('');
  const contentRef = useRef<string>('');
  const [initKey, setInitKey] = useState(0);

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
        vditorRef.current?.setValue(doc.content);
        contentRef.current = doc.content;
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
    contentRef.current = doc.content || '';
    isInitializedRef.current = false;

    const vditor = new Vditor(containerRef.current, {
      mode: 'ir',
      height: '100%',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'classic',
      toolbarConfig: {
        pin: true,
      },
      outline: {
        enable: true,
        position: 'right',
      },
      cdn: 'https://unpkg.com/vditor@3.11.2',
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
        emoji: {},
      },
      // 工具栏配置
      toolbar: [
        'emoji',
        'headings',
        'bold',
        'italic',
        'strike',
        'link',
        '|',
        'list',
        'ordered-list',
        'check',
        'outdent',
        'indent',
        '|',
        'quote',
        'line',
        'code',
        'inline-code',
        {
          name: 'table',
          tip: '表格 | Ctrl+M\n━━━━━━━━━━━━━\n添加行: Ctrl+=\n删除行: Ctrl+-\n添加列: Ctrl+Shift+=\n删除列: Ctrl+Shift+-\n上插行: Ctrl+Shift+F\n左插列: Ctrl+Shift+G',
          tipPosition: 's',
        },
        '|',
        'undo',
        'redo',
        '|',
        'outline',
        'edit-mode',
        {
          name: 'more',
          toolbar: [
            'export',
            'fullscreen',
            'preview',
            'devtools',
            'info',
            'help',
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
              const pathSep = '\\';
              const imgDirPath = `${docDir}${pathSep}${imageDirectory}`;
              
              const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
              
              try {
                await mkdir(imgDirPath, { recursive: true });
              } catch (e) {
                // 目录已存在，忽略错误
              }
              
              for (const file of files) {
                const timestamp = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
                const fileName = `${timestamp}_${safeName}`;
                const filePath = `${imgDirPath}${pathSep}${fileName}`;
                
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                await writeFile(filePath, uint8Array);
                
                const relativePath = `${imageDirectory}/${fileName}`;
                const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})`;
                vditorRef.current?.insertValue(markdown);
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
            
            for (const file of files) {
              const timestamp = Date.now();
              const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
              const fileName = `${timestamp}_${safeName}`;
              
              const fileHandle = await imgDir.getFileHandle(fileName, { create: true });
              const writable = await fileHandle.createWritable();
              await writable.write(file);
              await writable.close();
              
              const relativePath = `${imageDirectory}/${fileName}`;
              const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})`;
              vditorRef.current?.insertValue(markdown);
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
      input: (value: string) => {
        updateDocument(path, value);
        // 使用 setTimeout 确保 vditorRef 已设置
        setTimeout(() => {
          const md = vditorRef.current?.getValue() || '';
          const plainText = countPlainText(md);
          console.log('[Counter] md:', JSON.stringify(md), 'length:', md.length, 'plainText:', plainText);
          const store = useEditorStore.getState();
          store.setMarkdownLength(md.length);
          store.setWordCount(plainText);
        }, 0);
      },
      // 自定义快捷键
      keydown: (event: KeyboardEvent) => {
        // Ctrl+S 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          saveToFile();
          return true;
        }
        
        // Ctrl+Shift+Z 重做 - 触发工具栏 redo 按钮
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          const redoBtn = containerRef.current?.querySelector('.vditor-toolbar button[data-type="redo"]') as HTMLButtonElement;
          if (redoBtn) {
            redoBtn.click();
          }
          return true;
        }
        
        // Tab 键 - 由 capture handler 处理，这里阻止 Vditor 默认行为
        if (event.key === 'Tab' && !event.ctrlKey && !event.metaKey) {
          return true;
        }
        
        // 表格内按Enter时显示快捷键提示
        if (event.key === 'Enter' && !event.ctrlKey && !event.shiftKey) {
          const selection = window.getSelection();
          if (selection && selection.rangeCount > 0) {
            const anchor = selection.anchorNode;
            if (anchor) {
              const cell = anchor.parentElement?.closest('td, th');
              if (cell) {
                showTableShortcutTip();
              }
            }
          }
        }
        
        return false;
      },
      // 编辑器准备就绪回调
      after: () => {
        vditorRef.current = vditor;
        isInitializedRef.current = true;
        
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
        
        // TOC 目录点击跳转处理（使用事件委托，绑定到容器）
        const handleTocClick = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          
          console.log('[TOC] click detected on:', target.className);
          
          const tocContainer = target.closest('.vditor-toc');
          if (!tocContainer) {
            console.log('[TOC] no toc container found');
            return;
          }
          
          console.log('[TOC] found toc container');
          
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
          
          console.log('[TOC] headingId:', headingId);
          
          if (headingId) {
            const vditorReset = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
            if (!vditorReset) {
              console.log('[TOC] no vditor-reset found');
              return;
            }
            
            let heading = vditorReset.querySelector(`[id="${headingId}"]`) as HTMLElement;
            
            if (!heading) {
              const headingText = decodeURIComponent(headingId);
              console.log('[TOC] searching for heading text:', headingText);
              const headings = vditorReset.querySelectorAll('h1, h2, h3, h4, h5, h6');
              for (const h of headings) {
                const hId = h.getAttribute('data-id') || h.getAttribute('data-node-id');
                const hText = h.textContent?.trim();
                console.log('[TOC] checking heading:', hText, 'id:', hId);
                if (hId === headingId || hText === headingText) {
                  heading = h as HTMLElement;
                  break;
                }
              }
            }
            
            if (heading) {
              console.log('[TOC] found heading, scrolling to:', heading.offsetTop);
              vditorReset.scrollTo({
                top: heading.offsetTop - 20,
                behavior: 'smooth'
              });
            } else {
              console.log('[TOC] heading not found');
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
              Vditor.mermaidRender(containerRef.current!, 'https://unpkg.com/vditor@3.11.2', theme);
            } catch (e) {
              console.warn('[Mermaid] 渲染失败:', e);
            }
          }
        };
        
        // 初始渲染
        setTimeout(renderMermaid, 100);
        
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
                Vditor.mermaidRender(containerRef.current!, 'https://unpkg.com/vditor@3.11.2', theme);
              } catch (e) {
                console.warn('[Mermaid] 渲染失败:', e);
              }
            }
          }, 300);
        };
        
        // 监听DOM变化，处理新插入的图片和代码块
        const imageObserver = new MutationObserver((mutations) => {
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
              }
            }
          }
        });
        
        imageObserver.observe(containerRef.current!, {
          childList: true,
          subtree: true,
        });
        
        // 自动滚动逻辑 - 类似 VS Code
        // 关键：滚动元素是 .vditor-reset，不是 .vditor-content
        const vditorReset = containerRef.current?.querySelector('.vditor-ir .vditor-reset') as HTMLElement;
        const contentEl = containerRef.current?.querySelector('.vditor-content') as HTMLElement;
        
        let isUserInput = false;
        
        const handleScroll = () => {
          if (!vditorReset || !contentEl || !isUserInput) return;
          
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
            vditorReset.scrollTop += scrollAmount;
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
        
        if (vditorReset) {
          vditorReset.addEventListener('keydown', handleKeyDown);
        }
        
        // 保存引用以便清理
        (vditorRef.current as any)._imageObserver = imageObserver;
        (vditorRef.current as any)._handleKeyDown = handleKeyDown;
        (vditorRef.current as any)._vditorReset = vditorReset;
      },
    });

    return () => {
      if (vditorRef.current) {
        console.log('[VditorEditor] 组件卸载，销毁编辑器');
        const imageObserver = (vditorRef.current as any)._imageObserver;
        const handleKeyDown = (vditorRef.current as any)._handleKeyDown;
        const vditorReset = (vditorRef.current as any)._vditorReset;
        const tabKeydownHandler = (vditorRef.current as any)._tabKeydownHandler;
        const tocClickHandler = (vditorRef.current as any)._tocClickHandler;
        const tocClickTarget = (vditorRef.current as any)._tocClickTarget;
        
        if (imageObserver) imageObserver.disconnect();
        if (handleKeyDown && vditorReset) {
          vditorReset.removeEventListener('keydown', handleKeyDown);
        }
        if (tabKeydownHandler && containerRef.current) {
          containerRef.current.removeEventListener('keydown', tabKeydownHandler, true);
        }
        if (tocClickHandler && tocClickTarget) {
          tocClickTarget.removeEventListener('click', tocClickHandler, true);
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
        if (mutation.attributeName === 'class') {
          const isDark = document.documentElement.classList.contains('dark');
          if (vditorRef.current) {
            vditorRef.current.setTheme(isDark ? 'dark' : 'classic');
          }
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="vditor-container">
      <div ref={containerRef} className="vditor-wrapper" />
    </div>
  );
});

VditorEditor.displayName = 'VditorEditor';

export default VditorEditor;
