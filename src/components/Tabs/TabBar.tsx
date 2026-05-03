import React from 'react';
import { useEditorStore } from '../../stores';
import { useSaveToFile, getFileName } from '../../hooks/useAutoSave';
import { FileText, X, Save } from 'lucide-react';

export const TabBar: React.FC = () => {
  const tabs = useEditorStore((state) => state.tabs);
  const activeDocPath = useEditorStore((state) => state.activeDocPath);
  const documents = useEditorStore((state) => state.documents);
  const setActiveDocument = useEditorStore((state) => state.setActiveDocument);
  const closeDocument = useEditorStore((state) => state.closeDocument);
  const saveToFile = useSaveToFile();

  if (tabs.length === 0) {
    return (
      <div className="h-10 bg-[var(--tab-bg)] border-b border-[var(--tab-border)] flex items-center px-4">
        <span className="text-xs text-[var(--editor-text-muted)] flex items-center gap-2">
          <FileText size={14} />
          MD Editor
        </span>
      </div>
    );
  }

  return (
    <div className="h-10 bg-[var(--tab-bg)] flex items-end overflow-x-auto border-b border-[var(--tab-border)]">
      {/* 标签列表 */}
      <div className="flex items-end h-full flex-1">
        {tabs.map((tabPath) => {
          const isActive = tabPath === activeDocPath;
          const doc = documents[tabPath];
          const isModified = doc?.isModified || false;
          const fileName = getFileName(tabPath);

          return (
            <div
              key={tabPath}
              className={`
                group relative flex items-center h-9 px-3 cursor-pointer
                transition-all duration-[var(--transition-fast)]
                min-w-[120px] max-w-[180px]
                ${isActive
                  ? 'bg-[var(--tab-active-bg)] text-[var(--editor-text)]'
                  : 'bg-[var(--tab-inactive-bg)] text-[var(--editor-text-secondary)] hover:bg-[var(--tab-active-bg)] hover:text-[var(--editor-text)]'
                }
              `}
              onClick={() => setActiveDocument(tabPath)}
            >
              {/* 激活指示器 */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--tab-active-indicator)]" />
              )}

              {/* 文件图标 */}
              <FileText
                size={14}
                className={`
                  mr-2 flex-shrink-0
                  ${isActive ? 'text-[var(--accent-500)]' : 'text-[var(--editor-text-muted)]'}
                `}
              />

              {/* 修改指示器 */}
              {isModified && (
                <span className="w-2 h-2 rounded-full bg-[var(--accent-500)] mr-2 flex-shrink-0" />
              )}

              {/* 文件名 */}
              <span className="text-sm truncate flex-1 font-medium" title={fileName}>
                {fileName}
              </span>

              {/* 关闭按钮 */}
              <button
                className={`
                  ml-2 p-1 rounded-md flex-shrink-0
                  transition-all duration-[var(--transition-fast)]
                  ${isActive
                    ? 'opacity-0 group-hover:opacity-100 hover:bg-[var(--sidebar-hover)]'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-[var(--sidebar-active)]'
                  }
                  text-[var(--editor-text-muted)] hover:text-[var(--editor-text)]
                `}
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

      {/* 右侧操作区 */}
      {activeDocPath && (
        <div className="flex items-center h-9 px-2 gap-1">
          <button
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              bg-[var(--accent-500)] text-white
              hover:bg-[var(--accent-600)]
              transition-all duration-[var(--transition-fast)]
              shadow-sm hover:shadow
            `}
            onClick={saveToFile}
            title="保存到本地文件 (Ctrl+S)"
          >
            <Save size={14} />
            <span>保存</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TabBar;
