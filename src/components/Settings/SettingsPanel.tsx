import React, { useState, useEffect, useCallback } from 'react';
import { useSettingsStore, EMBED_MAX_DEPTH_MIN, EMBED_MAX_DEPTH_MAX, EMBED_MAX_COUNT_MIN, EMBED_MAX_COUNT_MAX, EditorWidth, LineHeight } from '../../stores/settingsStore';
import { X, Palette, Pencil, Keyboard, Info, Columns, AlignLeft, ExternalLink, Hash, Image, Save, FileText, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { ThemePanel } from '../ThemePanel/ThemePanel';
import { ShortcutsPanel } from '../Shortcuts/ShortcutsPanel';
import { useUpdateStore } from '../../stores';
import { UpdateNotification } from '../Update/UpdateNotification';
import { version } from '../../../package.json';

type TabId = 'general' | 'editor' | 'shortcuts' | 'about';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: '常规', icon: Palette },
  { id: 'editor', label: '编辑', icon: Pencil },
  { id: 'shortcuts', label: '快捷键', icon: Keyboard },
  { id: 'about', label: '关于', icon: Info },
];

export const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [checkFeedback, setCheckFeedback] = useState<string | null>(null);
  const updateStore = useUpdateStore();
  const feedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleManualCheck = useCallback(async () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setCheckFeedback(null);
    setShowUpdateDialog(false);

    await updateStore.checkForUpdate();

    const status = useUpdateStore.getState().checkStatus;
    if (status === 'found') {
      setShowUpdateDialog(true);
      setCheckFeedback(null);
    } else if (status === 'latest') {
      setCheckFeedback('已是最新版本');
      feedbackTimerRef.current = setTimeout(() => setCheckFeedback(null), 3000);
    } else {
      setCheckFeedback('检查失败，请检查网络');
      feedbackTimerRef.current = setTimeout(() => setCheckFeedback(null), 3000);
    }
  }, [updateStore]);

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
    headingFolding,
    setImageDirectory,
    setAutoSave,
    setAutoSaveDelay,
    setEmbedMaxDepth,
    setEmbedMaxCount,
    setEditorWidth,
    setLineHeight,
    setHeadingFolding,
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
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          <div className="ml-auto relative w-full max-w-md bg-[var(--editor-bg)] shadow-2xl animate-slide-up">
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

            <div className="flex border-b border-[var(--editor-border)]">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    className={`
                      flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium
                      transition-all duration-[var(--transition-fast)]
                      relative
                      ${activeTab === tab.id
                        ? 'text-[var(--accent-500)]'
                        : 'text-[var(--editor-text-secondary)] hover:text-[var(--editor-text)]'
                      }
                    `}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                    {activeTab === tab.id && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--accent-500)] rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-5 overflow-y-auto h-[calc(100vh-112px)]">
              {activeTab === 'general' && (
                <div>
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

                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                      <Hash size={16} className="text-[var(--accent-400)]" />
                      <h3 className="text-sm font-medium text-[var(--editor-text)]">标题折叠</h3>
                    </div>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer group" onClick={() => setHeadingFolding(!headingFolding)}>
                        <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${headingFolding ? 'bg-[var(--accent-500)]' : 'bg-[var(--editor-border)]'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${headingFolding ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                        <span className="text-sm text-[var(--editor-text-secondary)]">启用标题折叠</span>
                      </label>
                      <p className="text-xs text-[var(--editor-text-muted)]">
                        在标题旁显示折叠图标，可折叠标题下的内容
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'editor' && (
                <div>
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
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <ShortcutsPanel mode="embedded" />
              )}

              {activeTab === 'about' && (
                <div>
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

                    <div className="flex items-center gap-2 mb-4">
                      <button
                        onClick={handleManualCheck}
                        disabled={updateStore.checking}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-500)] text-white hover:bg-[var(--accent-600)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <RefreshCw
                          size={12}
                          className={updateStore.checking ? 'animate-spin' : ''}
                        />
                        {updateStore.checking ? '检查中...' : '检查更新'}
                      </button>

                      {checkFeedback && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                            checkFeedback === '已是最新版本'
                              ? 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                              : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {checkFeedback === '已是最新版本' ? (
                            <CheckCircle2 size={12} />
                          ) : (
                            <AlertCircle size={12} />
                          )}
                          {checkFeedback}
                        </span>
                      )}
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
              )}
            </div>
          </div>
        </div>
      )}

      {showUpdateDialog && (
        <UpdateNotification onClose={() => setShowUpdateDialog(false)} />
      )}
    </>
  );
};

export default SettingsPanel;
