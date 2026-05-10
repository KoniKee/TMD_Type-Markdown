import React from 'react';
import { FilePlus, FileText } from 'lucide-react';

interface PaneWelcomeProps {
  onNewFile: () => void;
  onOpenFile: () => void;
}

export const PaneWelcome: React.FC<PaneWelcomeProps> = ({ onNewFile, onOpenFile }) => {
  return (
    <div className="h-full flex items-center justify-center bg-[var(--editor-bg)]">
      <div className="text-center max-w-xs px-6">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-[var(--editor-link)] bg-opacity-10 mb-3">
            <span className="text-3xl">📄</span>
          </div>
          <h2 className="text-lg font-medium text-[var(--editor-text)] mb-1">
            空窗格
          </h2>
          <p className="text-sm text-[var(--editor-text)] opacity-60">
            在此窗格中打开文档
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={onNewFile}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--editor-link)] text-white hover:opacity-90 transition-opacity text-sm"
          >
            <FilePlus size={16} />
            <span>新建文档</span>
          </button>
          <button
            onClick={onOpenFile}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--sidebar-bg)] border border-[var(--editor-border)] hover:bg-[var(--sidebar-hover)] transition-colors text-sm"
          >
            <FileText size={16} />
            <span>打开文件</span>
          </button>
        </div>

        <div className="mt-6 text-xs text-[var(--editor-text)] opacity-40">
          右键菜单可查看更多选项
        </div>
      </div>
    </div>
  );
};

export default PaneWelcome;
