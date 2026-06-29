import React, { useState } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import { TitleBar } from '../TitleBar/TitleBar';
import { EditorContainer } from '../Editor/EditorContainer';
import { SettingsPanel } from '../Settings/SettingsPanel';
import { useEditorStore } from '../../stores';
import { useAutoSave, useTheme, useFileChangeDetection, useSplitShortcuts, useTabShortcuts } from '../../hooks';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Layout: React.FC = () => {
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useAutoSave();
  useTheme();
  useFileChangeDetection();
  useSplitShortcuts();
  useTabShortcuts();

  const handleSidebarResize = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newWidth = Math.max(180, Math.min(400, startWidth + diff));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--editor-bg)] text-[var(--editor-text)]">
      {/* Sidebar */}
      <div
        className="flex-shrink-0 relative transition-all duration-[var(--transition-normal)]"
        style={{ width: isSidebarCollapsed ? 0 : sidebarWidth }}
      >
        {!isSidebarCollapsed && <Sidebar />}

        {/* Resize handle */}
        {!isSidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize group"
            onMouseDown={handleSidebarResize}
          >
            <div className="w-px h-full bg-[var(--editor-border)] group-hover:bg-[var(--accent-500)] transition-colors" />
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* TitleBar - 包含 Tab 页签和窗口控制 */}
        <TitleBar />

        {/* Editor area */}
        <div className="flex-1 overflow-hidden">
          <EditorContainer />
        </div>

        {/* Status bar */}
        <StatusBar />
      </div>

      {/* Toggle sidebar button */}
      <button
        className={`
          absolute top-1/2 transform -translate-y-1/2 z-10
          w-6 h-12 flex items-center justify-center
          bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)]
          rounded-r-lg shadow-sm
          text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]
          hover:bg-[var(--sidebar-hover)]
          transition-all duration-[var(--transition-fast)]
          group
        `}
        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        style={{ left: isSidebarCollapsed ? 0 : sidebarWidth - 1 }}
      >
        {isSidebarCollapsed ? (
          <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
        ) : (
          <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
        )}
      </button>

      {/* Settings panel */}
      <SettingsPanel />
    </div>
  );
};

const StatusBar: React.FC = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const wordCount = useEditorStore((state) => state.wordCount);
  const markdownLength = useEditorStore((state) => state.markdownLength);

  const getStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return '保存中...';
      case 'unsaved':
        return '未保存';
      default:
        return '已保存';
    }
  };

  const getStatusColor = () => {
    switch (saveStatus) {
      case 'saving':
        return 'text-[var(--warning-500)]';
      case 'unsaved':
        return 'text-[var(--error-500)]';
      default:
        return 'text-[var(--success-500)]';
    }
  };

  return (
    <div className="h-6 px-4 flex items-center justify-between text-xs bg-[var(--statusbar-bg)] border-t border-[var(--editor-border)] select-none">
      <div className="flex items-center gap-2 text-[var(--statusbar-text)]">
        <span className="opacity-70">
          {activeDocPath ? activeDocPath.replace('file://', '') : '未打开文件'}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[var(--statusbar-text)]">
        <span 
          className="cursor-help relative group"
        >
          <span className="opacity-70">{wordCount} 字</span>
          <span 
            className="absolute bottom-full right-0 mb-2 px-3 py-2 text-xs rounded-lg shadow-2xl whitespace-nowrap pointer-events-none z-[100] border font-medium hidden group-hover:block"
            style={{ 
              backgroundColor: 'var(--editor-surface)',
              color: 'var(--editor-text)',
              borderColor: 'var(--editor-border)'
            }}
          >
            <div className="flex justify-between gap-4">
              <span style={{ color: 'var(--editor-text-secondary)' }}>字数</span>
              <span>{wordCount}</span>
            </div>
            <div className="flex justify-between gap-4 mt-1">
              <span style={{ color: 'var(--editor-text-secondary)' }}>Markdown文本</span>
              <span>{markdownLength}</span>
            </div>
          </span>
        </span>
        <span className={`flex items-center gap-1 ${getStatusColor()}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            saveStatus === 'saving' ? 'bg-[var(--warning-500)] animate-pulse' :
            saveStatus === 'unsaved' ? 'bg-[var(--error-500)]' :
            'bg-[var(--success-500)]'
          }`} />
          {getStatusText()}
        </span>
        <span className="opacity-70">Markdown</span>
      </div>
    </div>
  );
};

export default Layout;
