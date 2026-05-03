import React, { useState } from 'react';
import { useFileOperations } from '../../hooks/useFileOperations';
import {
  FilePlus,
  FileText,
  FolderOpen,
  Settings,
  Moon,
  Sun,
  Search,
  Command,
  LucideIcon,
  X,
  Keyboard
} from 'lucide-react';
import { useSettingsStore } from '../../stores';

/**
 * 顶部工具栏组件
 * 现代化设计 - 使用 SVG 图标，清晰分组，优雅悬停效果
 */
export const Toolbar: React.FC = () => {
  const { handleNewFile, handleOpenFile, handleOpenFolder } = useFileOperations();
  const { theme, toggleTheme } = useSettingsStore();
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <>
      <div className="h-11 bg-[var(--toolbar-bg)] border-b border-[var(--editor-border)] flex items-center px-3 gap-1 select-none">
        {/* Logo / App Name */}
        <div className="flex items-center gap-2 mr-3 pr-3 border-r border-[var(--editor-border)]">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="text-sm font-semibold text-[var(--editor-text)] hidden sm:inline">
            MD Editor
          </span>
        </div>

        {/* 文件操作组 */}
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={FilePlus}
            title="新建文档 (Ctrl+N)"
            onClick={handleNewFile}
            shortcut="Ctrl+N"
          />
          <ToolbarButton
            icon={FileText}
            title="打开文件 (Ctrl+O)"
            onClick={handleOpenFile}
            shortcut="Ctrl+O"
          />
          <ToolbarButton
            icon={FolderOpen}
            title="打开文件夹 (Ctrl+Shift+O)"
            onClick={handleOpenFolder}
            shortcut="Ctrl+Shift+O"
          />
        </div>

        {/* 分隔线 */}
        <div className="w-px h-5 bg-[var(--editor-border)] mx-2" />

        {/* 搜索按钮 */}
        <ToolbarButton
          icon={Search}
          title="搜索 (Ctrl+F)"
          onClick={() => {}}
          shortcut="Ctrl+F"
        />

        {/* 右侧工具 */}
        <div className="ml-auto flex items-center gap-0.5">
          {/* 快捷键提示 */}
          <ToolbarButton
            icon={Command}
            title="快捷键"
            onClick={() => setShowShortcuts(true)}
          />

          {/* 分隔线 */}
          <div className="w-px h-5 bg-[var(--editor-border)] mx-1" />

          {/* 主题切换 */}
          <ToolbarButton
            icon={theme === 'dark' ? Sun : Moon}
            title={theme === 'dark' ? '切换到浅色模式' : '切换到暗色模式'}
            onClick={toggleTheme}
          />
        </div>
      </div>

      {/* 快捷键弹窗 */}
      {showShortcuts && (
        <ShortcutsDialog onClose={() => setShowShortcuts(false)} />
      )}
    </>
  );
};

/**
 * 快捷键弹窗
 */
const ShortcutsDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const shortcuts = [
    { category: '文件操作', items: [
      { key: 'Ctrl + N', action: '新建文档' },
      { key: 'Ctrl + O', action: '打开文件' },
      { key: 'Ctrl + Shift + O', action: '打开文件夹' },
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
      {/* 背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* 弹窗内容 */}
      <div className="relative bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] w-[500px] max-h-[80vh] overflow-hidden animate-scale-in">
        {/* 标题栏 */}
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
        
        {/* 快捷键列表 */}
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

/**
 * 工具栏按钮组件
 * 带有优雅的悬停动画和工具提示
 */
interface ToolbarButtonProps {
  icon: LucideIcon;
  title: string;
  onClick: () => void;
  shortcut?: string;
  active?: boolean;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  icon: Icon,
  title,
  onClick,
  shortcut,
  active = false
}) => {
  return (
    <button
      className={`
        group relative flex items-center justify-center
        w-8 h-8 rounded-md
        transition-all duration-[var(--transition-fast)]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-500)] focus-visible:ring-offset-1
        ${active
          ? 'bg-[var(--toolbar-active)] text-[var(--accent-500)]'
          : 'text-[var(--editor-text-secondary)] hover:bg-[var(--toolbar-hover)] hover:text-[var(--editor-text)] active:bg-[var(--toolbar-active)]'
        }
      `}
      onClick={onClick}
      title={shortcut ? `${title} (${shortcut})` : title}
    >
      <Icon size={18} className="transition-transform duration-[var(--transition-fast)] group-hover:scale-110" />

      {/* 悬停提示 */}
      <div className="
        absolute top-full left-1/2 -translate-x-1/2 mt-2
        px-2 py-1 rounded-md
        bg-[var(--editor-text)] text-[var(--editor-bg)]
        text-xs whitespace-nowrap
        opacity-0 invisible
        group-hover:opacity-100 group-hover:visible
        transition-all duration-[var(--transition-fast)]
        pointer-events-none z-50
        shadow-lg
      ">
        {title}
        {shortcut && (
          <span className="ml-1.5 opacity-70 text-[10px]">{shortcut}</span>
        )}
      </div>
    </button>
  );
};

export default Toolbar;
