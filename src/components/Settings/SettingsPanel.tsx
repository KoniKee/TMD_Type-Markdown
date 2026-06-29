import React, { useState, useEffect } from 'react';
import { useSettingsStore, EMBED_MAX_DEPTH_MIN, EMBED_MAX_DEPTH_MAX, EMBED_MAX_COUNT_MIN, EMBED_MAX_COUNT_MAX, EditorWidth, LineHeight } from '../../stores/settingsStore';
import { X, Palette, Image, Save, Info, FileText, Columns, AlignLeft, ExternalLink } from 'lucide-react';
import { ThemePanel } from '../ThemePanel/ThemePanel';
import { version } from '../../../package.json';

export const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpenSettings = () => setIsOpen(true);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);
  const {
    imageDirectory,
    autoSave,
    autoSaveDelay,
    embedMaxDepth,
    embedMaxCount,
    editorWidth,
    lineHeight,
    setImageDirectory,
    setAutoSave,
    setAutoSaveDelay,
    setEmbedMaxDepth,
    setEmbedMaxCount,
    setEditorWidth,
    setLineHeight,
  } = useSettingsStore();

  const handleImageDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageDirectory(e.target.value);
  };

  const handleAutoSaveToggle = () => {
    setAutoSave(!autoSave);
  };

  const handleAutoSaveDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 0) {
      setAutoSaveDelay(value);
    }
  };

  const handleEmbedMaxDepthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setEmbedMaxDepth(value);
    }
  };

  const handleEmbedMaxCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      setEmbedMaxCount(value);
    }
  };

  const handleEditorWidthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEditorWidth(e.target.value as EditorWidth);
  };

  const handleLineHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLineHeight(parseFloat(e.target.value) as LineHeight);
  };

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex animate-fade-in">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer */}
          <div className="ml-auto relative w-full max-w-md bg-[var(--editor-bg)] shadow-2xl animate-slide-up">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--editor-border)]">
              <h2 className="text-base font-semibold text-[var(--editor-text)]">设置</h2>
              <button
                className="p-2 rounded-lg hover:bg-[var(--sidebar-hover)] text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)] transition-colors"
                onClick={() => setIsOpen(false)}
                aria-label="关闭设置"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 overflow-y-auto h-[calc(100vh-64px)]">
              {/* Theme settings */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Palette size={16} className="text-[var(--accent-400)]" />
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">主题设置</h3>
                </div>
                <ThemePanel embedded />
                <p className="text-xs text-[var(--editor-text-muted)] mt-3">
                  主题变化将实时生效
                </p>
              </div>

            {/* Editor width settings */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Columns size={16} className="text-[var(--accent-400)]" />
                <h3 className="text-sm font-medium text-[var(--editor-text)]">编辑区域宽度</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                    内容宽度
                  </label>
                  <select
                    value={editorWidth}
                    onChange={handleEditorWidthChange}
                    className="w-full px-3 py-2.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all cursor-pointer"
                  >
                    <option value="full">全宽 - 自适应铺满</option>
                    <option value="wide">较宽 - 960px</option>
                    <option value="normal">普通 - 750px</option>
                  </select>
                </div>
                <p className="text-xs text-[var(--editor-text-muted)]">
                  调整编辑区域的最大宽度，适合不同阅读习惯
                </p>
              </div>
            </div>

            {/* Line height settings */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <AlignLeft size={16} className="text-[var(--accent-400)]" />
                <h3 className="text-sm font-medium text-[var(--editor-text)]">行高设置</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                    行高倍数
                  </label>
                  <select
                    value={lineHeight}
                    onChange={handleLineHeightChange}
                    className="w-full px-3 py-2.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all cursor-pointer"
                  >
                    <option value="1">1.0 倍</option>
                    <option value="1.15">1.15 倍</option>
                    <option value="1.5">1.5 倍（默认）</option>
                    <option value="2">2.0 倍</option>
                    <option value="2.5">2.5 倍</option>
                    <option value="3">3.0 倍</option>
                  </select>
                </div>
                <p className="text-xs text-[var(--editor-text-muted)]">
                  调整编辑器的行高，影响阅读舒适度
                </p>
              </div>
            </div>

            {/* Image directory settings */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Image size={16} className="text-[var(--accent-400)]" />
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">图片目录设置</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                      图片目录名称
                    </label>
                    <input
                      type="text"
                      value={imageDirectory}
                      onChange={handleImageDirectoryChange}
                      className="w-full px-3 py-2.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all"
                      placeholder="img"
                    />
                  </div>
                  <p className="text-xs text-[var(--editor-text-muted)]">
                    图片将保存到文档同级的此目录
                  </p>
                </div>
              </div>

              {/* Auto-save settings */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Save size={16} className="text-[var(--success-500)]" />
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">自动保存设置</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[var(--editor-surface)] rounded-lg">
                    <div>
                      <label className="block text-sm text-[var(--editor-text)]">
                        启用自动保存
                      </label>
                      <p className="text-xs text-[var(--editor-text-muted)] mt-0.5">
                        自动保存文档更改
                      </p>
                    </div>
                    <button
                      onClick={handleAutoSaveToggle}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        autoSave ? 'bg-[var(--accent-500)]' : 'bg-[var(--editor-border)]'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          autoSave ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {autoSave && (
                    <div className="p-3 bg-[var(--editor-surface)] rounded-lg">
                      <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                        自动保存延迟 (毫秒)
                      </label>
                      <input
                        type="number"
                        value={autoSaveDelay}
                        onChange={handleAutoSaveDelayChange}
                        min="0"
                        step="100"
                        className="w-full px-3 py-2 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Embed settings */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={16} className="text-[var(--accent-400)]" />
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">预览模式额外渲染md文档限制</h3>
                </div>
                <div className="space-y-3">
                  <div className="p-3 bg-[var(--editor-surface)] rounded-lg">
                    <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                      最大嵌套深度
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={embedMaxDepth}
                        onChange={handleEmbedMaxDepthChange}
                        min={EMBED_MAX_DEPTH_MIN}
                        max={EMBED_MAX_DEPTH_MAX}
                        className="w-20 px-3 py-2 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all"
                      />
                      <span className="text-xs text-[var(--editor-text-muted)]">
                        (范围 {EMBED_MAX_DEPTH_MIN}-{EMBED_MAX_DEPTH_MAX})
                      </span>
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--editor-surface)] rounded-lg">
                    <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                      最大嵌入文档数
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={embedMaxCount}
                        onChange={handleEmbedMaxCountChange}
                        min={EMBED_MAX_COUNT_MIN}
                        max={EMBED_MAX_COUNT_MAX}
                        className="w-20 px-3 py-2 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all"
                      />
                      <span className="text-xs text-[var(--editor-text-muted)]">
                        (范围 {EMBED_MAX_COUNT_MIN}-{EMBED_MAX_COUNT_MAX})
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--editor-text-muted)]">
                    💡 数值越大，渲染时间越长
                  </p>
                </div>
              </div>

              {/* About section */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={16} className="text-[var(--editor-text-secondary)]" />
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">关于</h3>
                </div>
                <div className="bg-[var(--editor-surface)] rounded-xl p-4">
                  <div className="flex items-center mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent-400)] to-[var(--accent-600)] flex items-center justify-center mr-3 shadow-lg">
                      <span className="text-white font-bold text-lg">M</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-[var(--editor-text)]">MD Editor</h4>
                      <p className="text-xs text-[var(--editor-text-muted)]">版本 {version}</p>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--editor-text-secondary)] space-y-2">
                    <p className="font-medium text-[var(--editor-text)]">技术栈</p>
                    <div className="flex flex-wrap gap-2">
                      {['React 18', 'TypeScript', 'TailwindCSS', 'Tauri 2', 'Vditor', 'Zustand'].map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-1 bg-[var(--editor-bg)] rounded-md text-[var(--editor-text-muted)]"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                    <div className="pt-2">
                      <a
                        href="https://github.com/KoniKee/TMD_Type-Markdown"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[var(--accent-500)] hover:text-[var(--accent-600)] transition-colors"
                      >
                        <ExternalLink size={14} />
                        <span>GitHub 仓库</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SettingsPanel;
