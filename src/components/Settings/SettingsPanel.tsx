import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import { Settings, X, Sun, Moon, Monitor, Image, Save, Info } from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const {
    theme,
    imageDirectory,
    autoSave,
    autoSaveDelay,
    setTheme,
    setImageDirectory,
    setAutoSave,
    setAutoSaveDelay,
  } = useSettingsStore();

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as 'light' | 'dark' | 'system');
  };

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

  return (
    <>
      {/* Settings trigger button */}
      <button
        className="fixed bottom-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] shadow-lg hover:bg-[var(--sidebar-hover)] hover:shadow-xl transition-all duration-[var(--transition-fast)] group"
        onClick={() => setIsOpen(true)}
        aria-label="打开设置"
      >
        <Settings
          size={20}
          className="text-[var(--editor-text-secondary)] group-hover:text-[var(--editor-text)] group-hover:rotate-90 transition-all duration-300"
        />
      </button>

      {/* Settings drawer */}
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
                  {theme === 'dark' ? <Moon size={16} className="text-[var(--accent-400)]" /> : 
                   theme === 'light' ? <Sun size={16} className="text-[var(--warning-500)]" /> :
                   <Monitor size={16} className="text-[var(--editor-text-secondary)]" />}
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">主题设置</h3>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-[var(--editor-text-secondary)] mb-2">
                      主题模式
                    </label>
                    <select
                      value={theme}
                      onChange={handleThemeChange}
                      className="w-full px-3 py-2.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg text-[var(--editor-text)] focus:outline-none focus:border-[var(--accent-500)] focus:ring-2 focus:ring-[var(--accent-500)]/20 transition-all cursor-pointer"
                    >
                      <option value="light">🌞 亮色主题</option>
                      <option value="dark">🌙 暗色主题</option>
                      <option value="system">💻 跟随系统</option>
                    </select>
                  </div>
                  <p className="text-xs text-[var(--editor-text-muted)]">
                    主题变化将实时生效
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
                      <p className="text-xs text-[var(--editor-text-muted)]">版本 0.1.0</p>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--editor-text-secondary)] space-y-2">
                    <p className="font-medium text-[var(--editor-text)]">技术栈</p>
                    <div className="flex flex-wrap gap-2">
                      {['React 18', 'TypeScript', 'TailwindCSS', 'Tauri', 'ProseMirror', 'Zustand'].map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-1 bg-[var(--editor-bg)] rounded-md text-[var(--editor-text-muted)]"
                        >
                          {tech}
                        </span>
                      ))}
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
