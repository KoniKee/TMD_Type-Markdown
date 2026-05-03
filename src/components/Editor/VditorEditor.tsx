import React, { useRef, useEffect, useState } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './vditor-styles.css';
import { useEditorStore, useFileStore, useSettingsStore } from '../../stores';
import { useSaveToFile } from '../../hooks/useAutoSave';
import { isTauriCached } from '../../utils/platform';

interface VditorEditorProps {
  path: string;
}

let tableTipTimeout: number | null = null;
let tableTipElement: HTMLDivElement | null = null;
let hasShownTableTip = false;

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
      // Tauri 环境：直接返回相对路径，Tauri 可以直接加载
      // 或者读取文件转为 blob URL
      const { readFile } = await import('@tauri-apps/plugin-fs');
      
      // 从文档路径提取目录路径
      let docDir = '';
      if (docPath.startsWith('file://')) {
        const fullPath = docPath.replace('file://', '');
        const lastSlash = fullPath.lastIndexOf('/');
        if (lastSlash > 0) {
          docDir = fullPath.substring(0, lastSlash);
        }
      }
      
      const imagePath = `${docDir}/${cleanSrc}`;
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

  // 当 path 变化时初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 从 store 获取文档（不订阅）
    const documents = useEditorStore.getState().documents;
    const doc = documents[path];
    if (!doc) {
      console.log('[VditorEditor] 文档不存在:', path);
      return;
    }
    
    // 如果内容为空，等待延迟加载
    if (!doc.content) {
      console.log('[VditorEditor] 文档内容为空，等待加载:', path);
      currentPathRef.current = path;
      contentRef.current = '';
      isInitializedRef.current = false;
      return;
    }
    
    // 如果已初始化且是同一个文档，不重新初始化
    if (isInitializedRef.current && currentPathRef.current === path) {
      return;
    }

    // 销毁旧实例
    if (vditorRef.current) {
      console.log('[VditorEditor] 销毁旧实例');
      vditorRef.current.destroy();
      vditorRef.current = null;
    }

    currentPathRef.current = path;
    contentRef.current = doc.content;
    isInitializedRef.current = false;

    console.log('[VditorEditor] 初始化编辑器:', path, '内容长度:', doc.content.length);

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
      // 图片上传配置
      upload: {
        handler: async (files: File[]): Promise<null> => {
          const imageDirectory = useSettingsStore.getState().imageDirectory || 'img';
          
          // 没有打开文件夹，使用 base64
          const { rootHandle } = useFileStore.getState();
          if (!rootHandle && !isTauriCached()) {
            for (const file of files) {
              const base64 = await fileToBase64(file);
              const markdown = `![${file.name}](${base64})`;
              vditorRef.current?.insertValue(markdown);
            }
            return null;
          }
          
          try {
            // 获取当前文档所在目录路径
            let docDir = '';
            if (path.startsWith('file://')) {
              const fullPath = path.replace('file://', '');
              const lastSlash = fullPath.lastIndexOf('/');
              if (lastSlash > 0) {
                docDir = fullPath.substring(0, lastSlash);
              }
            }
            
            const imgDirPath = `${docDir}/${imageDirectory}`;
            
            if (isTauriCached()) {
              // Tauri 环境
              const { mkdir, writeFile } = await import('@tauri-apps/plugin-fs');
              
              // 创建图片目录
              try {
                await mkdir(imgDirPath, { recursive: true });
              } catch (e) {
                // 目录可能已存在
              }
              
              // 保存每个图片
              for (const file of files) {
                const timestamp = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5.]/g, '_');
                const fileName = `${timestamp}_${safeName}`;
                const filePath = `${imgDirPath}/${fileName}`;
                
                // 读取文件内容
                const arrayBuffer = await file.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                await writeFile(filePath, uint8Array);
                
                // 插入相对路径的 markdown 图片
                const relativePath = `${imageDirectory}/${fileName}`;
                const markdown = `![${safeName.replace(/\.[^.]+$/, '')}](${relativePath})`;
                vditorRef.current?.insertValue(markdown);
                
                console.log('[ImageUpload] 图片已保存:', relativePath);
              }
            } else {
              // 浏览器环境
              const { dirHandles, refreshFileTree } = useFileStore.getState();
              let docDirHandle: FileSystemDirectoryHandle = rootHandle!;
              
              // 从 path 中提取目录路径
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
              
              // 在当前文档所在目录下创建图片目录
              const imgDir = await docDirHandle.getDirectoryHandle(imageDirectory, { create: true });
              
              // 保存每个图片
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
                
                console.log('[ImageUpload] 图片已保存:', relativePath);
              }
              
              // 图片上传后刷新文件树
              refreshFileTree();
            }
          } catch (e) {
            console.error('[ImageUpload] 保存图片失败:', e);
            // 回退到 base64
            for (const file of files) {
              const base64 = await fileToBase64(file);
              const markdown = `![${file.name}](${base64})`;
              vditorRef.current?.insertValue(markdown);
            }
          }
          return null;
        },
      },
      // Tab行为配置
      tab: '\t',
      // 初始值
      value: contentRef.current,
      // 内容变化回调
      input: (value: string) => {
        updateDocument(path, value);
      },
      // 自定义快捷键
      keydown: (event: KeyboardEvent) => {
        // Ctrl+S 保存
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          saveToFile();
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
        console.log('[VditorEditor] 编辑器初始化完成');
        
        // 处理本地图片加载
        processLocalImages(containerRef.current!, path);
        
        // 监听DOM变化，处理新插入的图片
        const imageObserver = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            for (const node of Array.from(mutation.addedNodes)) {
              if (node instanceof HTMLImageElement) {
                handleLocalImage(node, path);
              } else if (node instanceof HTMLElement) {
                const imgs = node.querySelectorAll('img');
                imgs.forEach(img => handleLocalImage(img, path));
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
        // 断开观察器
        const imageObserver = (vditorRef.current as any)._imageObserver;
        const handleKeyDown = (vditorRef.current as any)._handleKeyDown;
        const vditorReset = (vditorRef.current as any)._vditorReset;
        
        if (imageObserver) imageObserver.disconnect();
        if (handleKeyDown && vditorReset) {
          vditorReset.removeEventListener('keydown', handleKeyDown);
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
