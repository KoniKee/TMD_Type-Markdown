import React from 'react';
import { X, ArrowUpCircle, Download } from 'lucide-react';
import { useUpdateStore } from '../../stores';
import { getCurrentVersion } from '../../utils/updateChecker';

interface Props {
  onClose: () => void;
}

const renderMarkdown = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  
  return lines.map((line, index) => {
    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="font-semibold text-base mt-3 mb-1 first:mt-0">
          {line.replace('### ', '')}
        </h4>
      );
    }
    
    if (line.startsWith('## ')) {
      return (
        <h3 key={index} className="font-semibold text-lg mt-4 mb-2 first:mt-0">
          {line.replace('## ', '')}
        </h3>
      );
    }
    
    if (line.startsWith('- ')) {
      const content = line.replace('- ', '');
      const parts = content.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={index} className="flex gap-2 ml-2">
          <span>•</span>
          <span>
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
              }
              return part;
            })}
          </span>
        </div>
      );
    }
    
    if (line.trim() === '') {
      return <div key={index} className="h-2" />;
    }
    
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <p key={index}>
        {parts.map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i}>{part.slice(2, -2)}</strong>;
          }
          return part;
        })}
      </p>
    );
  });
};

export const UpdateNotification: React.FC<Props> = ({ onClose }) => {
  const { latestVersion, releaseNotes, downloadUrl, publishedAt } = useUpdateStore();

  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
    onClose();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] w-[480px] overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
          <div className="flex items-center gap-2">
            <ArrowUpCircle size={18} className="text-[var(--accent-500)]" />
            <h2 className="text-base font-semibold text-[var(--editor-text)]">发现新版本</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-sm space-y-1">
            <p>
              <span className="text-[var(--editor-text-muted)]">当前版本：</span>
              v{getCurrentVersion()}
            </p>
            <p>
              <span className="text-[var(--editor-text-muted)]">最新版本：</span>
              {latestVersion}
            </p>
            {publishedAt && (
              <p>
                <span className="text-[var(--editor-text-muted)]">发布时间：</span>
                {formatDate(publishedAt)}
              </p>
            )}
          </div>

          {releaseNotes && (
            <div>
              <p className="text-sm text-[var(--editor-text-muted)] mb-2">更新内容：</p>
              <div className="text-sm bg-[var(--editor-code-bg)] rounded p-3 max-h-[200px] overflow-y-auto text-[var(--editor-text)]">
                {renderMarkdown(releaseNotes)}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--editor-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-[var(--sidebar-hover)] transition-colors text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)]"
          >
            稍后提醒
          </button>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-sm bg-[var(--accent-500)] text-white rounded-md hover:bg-[var(--accent-600)] transition-colors flex items-center gap-2"
          >
            <Download size={16} />
            前往下载
          </button>
        </div>
      </div>
    </div>
  );
};
