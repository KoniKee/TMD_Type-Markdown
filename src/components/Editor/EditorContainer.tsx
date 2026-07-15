import React from 'react';
import { useEditorStore } from '../../stores';
import { PaneContainer } from './PaneContainer';
import { useFileOperations } from '../../hooks/useFileOperations';
import { FilePlus, FileText, FolderOpen } from 'lucide-react';

const handleNewFile = (openDocument: any) => {
  const fileName = `新建文档-${Date.now()}.md`;
  const content = `# 新建文档\n\n在这里开始写作...\n`;
  openDocument(fileName, content, true);
};

export const EditorContainer: React.FC = () => {
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const activeTabPath = useEditorStore((state) => state.activeTabPath);
  const tabs = useEditorStore((state) => state.tabs);
  const openDocument = useEditorStore((state) => state.openDocument);
  const { handleOpenFolder, handleOpenFile } = useFileOperations();
  
  if (tabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--editor-bg)]">
        <div className="text-center max-w-lg px-8">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--editor-link)] bg-opacity-10 mb-4">
              <span className="text-4xl">📝</span>
            </div>
            <h1 className="text-2xl font-bold text-[var(--editor-text)] mb-2">
              Markdown 编辑器
            </h1>
            <p className="text-[var(--editor-text)] opacity-60">
              类似 Typora 的所见即所得 Markdown 编辑器
            </p>
          </div>

          <div className="flex gap-3 justify-center mb-8 flex-wrap">
            <button
              onClick={() => handleNewFile(openDocument)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--editor-link)] text-white hover:opacity-90 transition-opacity"
            >
              <FilePlus size={18} />
              <span>新建文档</span>
            </button>
            <button
              onClick={() => handleOpenFile()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--editor-border)] hover:bg-[var(--sidebar-hover)] transition-colors"
            >
              <FileText size={18} />
              <span>打开文件</span>
            </button>
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--editor-border)] hover:bg-[var(--sidebar-hover)] transition-colors"
            >
              <FolderOpen size={18} />
              <span>打开文件夹</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-lg bg-[var(--sidebar-bg)]">
              <div className="text-2xl mb-2">✨</div>
              <div className="font-medium mb-1">所见即所得</div>
              <div className="text-[var(--editor-text)] opacity-60">即时渲染模式</div>
            </div>
            <div className="p-4 rounded-lg bg-[var(--sidebar-bg)]">
              <div className="text-2xl mb-2">⌨️</div>
              <div className="font-medium mb-1">快捷键</div>
              <div className="text-[var(--editor-text)] opacity-60">Ctrl+B/I/S 快速格式化</div>
            </div>
            <div className="p-4 rounded-lg bg-[var(--sidebar-bg)]">
              <div className="text-2xl mb-2">🖼️</div>
              <div className="font-medium mb-1">图片粘贴</div>
              <div className="text-[var(--editor-text)] opacity-60">Ctrl+V 直接插入图片</div>
            </div>
          </div>

          <div className="mt-8 text-xs text-[var(--editor-text)] opacity-50">
            <div className="mb-1">快捷键：Ctrl+B 加粗 | Ctrl+I 斜体 | Ctrl+S 保存</div>
            <div>支持拖放 .md 文件到编辑器</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[var(--editor-bg)]">
      {tabs.map(tabPath => (
        <div
          key={tabPath}
          className="h-full"
          style={{ display: tabPath === activeTabPath ? undefined : 'none' }}
        >
          <PaneContainer tabPath={tabPath} />
        </div>
      ))}
    </div>
  );
};

export default EditorContainer;
