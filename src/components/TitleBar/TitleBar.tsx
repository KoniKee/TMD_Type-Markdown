import React, { useState, useEffect } from 'react';
import { useEditorStore, useSettingsStore } from '../../stores';
import { useSaveToFile, getFileName } from '../../hooks/useAutoSave';
import { isTauriCached } from '../../utils/platform';
import { FileText, X, Save, Moon, Sun, Keyboard, Minus, Square, X as CloseIcon, LucideIcon } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const tabs = useEditorStore((state) => state.tabs);
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const documents = useEditorStore((state) => state.documents);
  const setActiveDocument = useEditorStore((state) => state.setActiveDocument);
  const closeDocument = useEditorStore((state) => state.closeDocument);
  const saveToFile = useSaveToFile();
  const { theme, toggleTheme } = useSettingsStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [appWindow, setAppWindow] = useState<any>(null);

  useEffect(() => {
    if (isTauriCached()) {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        const win = getCurrentWindow();
        setAppWindow(win);
        win.onResized(async () => {
          setIsMaximized(await win.isMaximized());
        });
        win.isMaximized().then(setIsMaximized);
      });
    }
  }, []);

  const handleDrag = (e: React.MouseEvent) => {
    if (appWindow && e.button === 0) {
      appWindow.startDragging();
    }
  };

  const handleDoubleClick = () => {
    if (appWindow) {
      appWindow.toggleMaximize();
    }
  };

  const handleMinimize = () => {
    if (appWindow) {
      appWindow.minimize();
    }
  };

  const handleToggleMaximize = () => {
    if (appWindow) {
      appWindow.toggleMaximize();
    }
  };

  const handleClose = () => {
    if (appWindow) {
      appWindow.close();
    }
  };

  return (
    <>
      <div 
        className="h-10 bg-[var(--titlebar-bg)] border-b border-[var(--editor-border)] flex items-center select-none"
        onMouseDown={handleDrag}
        onDoubleClick={handleDoubleClick}
      >
        {/* Tab 页签区域 */}
        <div className="flex-1 flex items-end h-full min-w-0">
          {tabs.length === 0 ? (
            <div className="flex items-center h-full px-4">
              <span className="text-sm text-[var(--editor-text-muted)] flex items-center gap-2">
                <FileText size={14} />
                MD Editor
              </span>
            </div>
          ) : (
            <div className="flex items-end h-full flex-1 min-w-0">
              {tabs.map((tabPath) => {
                const isActive = tabPath === activeDocPath;
                const doc = documents[tabPath];
                const isModified = doc?.isModified || false;
                const fileName = getFileName(tabPath);

                return (
                  <div
                    key={tabPath}
                    className={`
                      group relative flex items-center h-[36px] px-3 cursor-pointer
                      transition-all duration-[var(--transition-fast)]
                      flex-1 min-w-[80px] max-w-[180px]
                      ${isActive
                        ? 'bg-[var(--editor-bg)] text-[var(--editor-text)]'
                        : 'bg-[var(--tab-inactive-bg)] text-[var(--editor-text-secondary)] hover:bg-[var(--tab-active-bg)] hover:text-[var(--editor-text)]'
                      }
                    `}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDocument(tabPath);
                    }}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--accent-500)]" />
                    )}

                    <FileText
                      size={14}
                      className={`mr-1.5 flex-shrink-0 ${isActive ? 'text-[var(--accent-500)]' : 'text-[var(--editor-text-muted)]'}`}
                    />

                    {isModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-500)] mr-1.5 flex-shrink-0" />
                    )}

                    <span className="text-sm truncate flex-1" title={fileName}>
                      {fileName}
                    </span>

                    <button
                      className={`
                        ml-1 p-0.5 rounded flex-shrink-0
                        opacity-0 group-hover:opacity-100
                        hover:bg-[var(--sidebar-hover)]
                        text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]
                        transition-all
                      `}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeDocument(tabPath);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 右侧拖拽区域 - 始终保留一小块空间 */}
        <div 
          className="w-20 h-full flex-shrink-0"
          onMouseDown={handleDrag}
          onDoubleClick={handleDoubleClick}
        />

        {/* 右侧操作区域 */}
        <div 
          className="flex items-center h-full flex-shrink-0"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 保存按钮 */}
          {activeDocPath && (
            <button
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] transition-all mx-1"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); saveToFile(); }}
              title="保存 (Ctrl+S)"
            >
              <Save size={12} />
              <span className="hidden sm:inline">保存</span>
            </button>
          )}

          {/* 快捷键按钮 */}
          <TitleBarButton
            icon={Keyboard}
            title="快捷键"
            onClick={() => setShowShortcuts(true)}
          />

          {/* 主题切换 */}
          <TitleBarButton
            icon={theme === 'dark' ? Sun : Moon}
            title={theme === 'dark' ? '浅色模式' : '暗色模式'}
            onClick={toggleTheme}
          />

          {/* 窗口控制按钮（仅 Tauri） */}
          {isTauriCached() && (
            <>
              <div className="w-px h-4 bg-[var(--editor-border)] mx-1" />
              <TitleBarButton
                icon={Minus}
                title="最小化"
                onClick={handleMinimize}
                isWindowControl
              />
              <TitleBarButton
                icon={Square}
                title={isMaximized ? '还原' : '最大化'}
                onClick={handleToggleMaximize}
                isWindowControl
                isActive={isMaximized}
              />
              <TitleBarButton
                icon={CloseIcon}
                title="关闭"
                onClick={handleClose}
                isWindowControl
                isClose
              />
            </>
          )}
        </div>
      </div>

      {/* 快捷键弹窗 */}
      {showShortcuts && (
        <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
      )}
    </>
  );
};

interface TitleBarButtonProps {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  isWindowControl?: boolean;
  isClose?: boolean;
  isActive?: boolean;
}

const TitleBarButton: React.FC<TitleBarButtonProps> = ({
  icon: Icon,
  title,
  onClick,
  isWindowControl = false,
  isClose = false,
  isActive = false,
}) => {
  return (
    <button
      className={`
        flex items-center justify-center
        ${isWindowControl ? 'w-11 h-10' : 'w-8 h-8 rounded-md mx-0.5'}
        transition-all duration-[var(--transition-fast)]
        ${isClose
          ? 'hover:bg-[var(--error-500)] hover:text-white'
          : isActive
            ? 'bg-[var(--sidebar-active)]'
            : 'hover:bg-[var(--toolbar-hover)]'
        }
        text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)]
      `}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
    >
      <Icon size={16} />
    </button>
  );
};

const ShortcutsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const shortcuts = [
    { category: '文件操作', items: [
      { key: 'Ctrl + S', action: '保存文件' },
    ]},
    { category: '编辑操作', items: [
      { key: 'Ctrl + B', action: '加粗' },
      { key: 'Ctrl + I', action: '斜体' },
      { key: 'Ctrl + D', action: '删除线' },
      { key: 'Ctrl + `', action: '行内代码' },
    ]},
    { category: '标题', items: [
      { key: 'Ctrl + 1', action: '一级标题' },
      { key: 'Ctrl + 2', action: '二级标题' },
      { key: 'Ctrl + 3', action: '三级标题' },
    ]},
    { category: '其他', items: [
      { key: 'Ctrl + M', action: '插入表格' },
      { key: 'Ctrl + Z', action: '撤销' },
      { key: 'Ctrl + Shift + Z', action: '重做' },
    ]},
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      <div className="relative bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] w-[500px] max-h-[80vh] overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-[var(--accent-500)]" />
            <h2 className="text-base font-semibold text-[var(--editor-text)]">键盘快捷键</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-60px)]">
          {shortcuts.map((group) => (
            <div key={group.category} className="mb-4 last:mb-0">
              <h3 className="text-xs font-semibold text-[var(--editor-text-secondary)] uppercase tracking-wider mb-2">
                {group.category}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <div 
                    key={item.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-[var(--sidebar-hover)] transition-colors"
                  >
                    <span className="text-sm text-[var(--editor-text)]">{item.action}</span>
                    <kbd className="px-2 py-0.5 text-xs font-mono bg-[var(--editor-code-bg)] text-[var(--editor-text-secondary)] rounded border border-[var(--editor-border)]">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
