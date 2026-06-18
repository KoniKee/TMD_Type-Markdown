import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface BatchCloseConfirmProps {
  documents: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

export const BatchCloseConfirm: React.FC<BatchCloseConfirmProps> = ({
  documents,
  onConfirm,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />
      
      <div className="relative bg-[var(--editor-bg)] rounded-xl shadow-2xl border border-[var(--editor-border)] w-[400px] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--editor-border)]">
          <AlertTriangle size={20} className="text-[var(--error-500)]" />
          <h2 className="text-base font-semibold text-[var(--editor-text)]">确认关闭</h2>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-[var(--error-500)] mb-3 font-medium">
            关闭后未保存内容将丢失
          </p>
          <p className="text-sm text-[var(--editor-text-secondary)] mb-3">
            以下文档有未保存的修改：
          </p>
          <ul className="text-sm text-[var(--editor-text)] space-y-1 max-h-[200px] overflow-y-auto">
            {documents.map((doc, index) => (
              <li key={index} className="flex items-center gap-2 py-1 px-2 rounded bg-[var(--sidebar-bg)]">
                <span className="w-2 h-2 rounded-full bg-[var(--accent-500)]" />
                <span className="truncate">{doc}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[var(--editor-border)]">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--sidebar-bg)] border border-[var(--editor-border)] hover:bg-[var(--sidebar-hover)] transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--error-500)] text-white hover:opacity-90 transition-opacity"
          >
            确定关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchCloseConfirm;
