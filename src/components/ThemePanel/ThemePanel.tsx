import React, { useEffect, useRef } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useSettingsStore, THEMES, ThemeId, ThemeGroup, Theme } from '../../stores/settingsStore';

interface ThemePanelProps {
  embedded?: boolean;  // 嵌入模式（SettingsPanel中使用），不显示浮层外壳
  onClose?: () => void; // 浮层模式关闭回调
}

// 每个主题的预览配色
const THEME_PREVIEW_COLORS: Record<ThemeId, string[]> = {
  'chen-guang': ['#ffffff', '#3b82f6', '#1e293b', '#e5e7eb'],
  'tian-qing': ['#f8fafc', '#3b82f6', '#334155', '#e2e8f0'],
  'hu-po': ['#FAF9F5', '#D97757', '#141413', '#E2DFD3'],
  'mo-ye': ['#0f172a', '#60a5fa', '#e2e8f0', '#334155'],
  'xing-yun': ['#282c34', '#61afef', '#abb2bf', '#3e4451'],
  'ji-guang': ['#2e3440', '#88c0d0', '#d8dee9', '#434c5e'],
};

// 按组分类的主题列表
const THEME_GROUPS: { label: string; key: ThemeGroup; themeIds: ThemeId[] }[] = [
  { label: 'Light', key: 'light', themeIds: ['chen-guang', 'tian-qing', 'hu-po'] },
  { label: 'Dark', key: 'dark', themeIds: ['mo-ye', 'xing-yun', 'ji-guang'] },
];

export const ThemePanel: React.FC<ThemePanelProps> = ({ embedded = false, onClose }) => {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const systemLightTheme = useSettingsStore((s) => s.systemLightTheme);
  const systemDarkTheme = useSettingsStore((s) => s.systemDarkTheme);
  const setSystemLightTheme = useSettingsStore((s) => s.setSystemLightTheme);
  const setSystemDarkTheme = useSettingsStore((s) => s.setSystemDarkTheme);
  const panelRef = useRef<HTMLDivElement>(null);

  // 浮层模式下，点击面板外区域关闭
  useEffect(() => {
    if (embedded) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    // 延迟绑定，避免触发按钮的点击事件立即关闭面板
    const timerId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timerId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [embedded, onClose]);

  // 选中判断：如果 theme === 'system'，则没有任何具体主题被选中
  const isSelected = (themeId: ThemeId) => theme === themeId;
  const isSystemSelected = () => theme === 'system';

  // 主题卡片内容
  const ThemeCardContent: React.FC<{ themeId: ThemeId }> = ({ themeId }) => {
    const themeInfo = THEMES[themeId];
    const colors = THEME_PREVIEW_COLORS[themeId];
    const active = isSelected(themeId);

    return (
      <button
        className={`
          flex flex-col items-center justify-center rounded-lg p-2
          transition-all duration-[var(--transition-fast)] cursor-pointer
          bg-[var(--editor-surface)]
          hover:bg-[var(--sidebar-hover)]
          ${active ? 'ring-2 ring-[var(--accent-500)] bg-[var(--sidebar-hover)]' : ''}
        `}
        style={{
          borderWidth: active ? '2px' : '0px',
          borderStyle: 'solid',
          borderColor: active ? 'var(--accent-500)' : 'transparent',
        }}
        onClick={() => setTheme(themeId)}
        title={themeInfo.name}
      >
        {/* 颜色圆点 */}
        <div className="flex items-center gap-1 mb-1.5">
          {colors.map((color, idx) => (
            <span
              key={idx}
              className="inline-block rounded-full"
              style={{
                width: 12,
                height: 12,
                backgroundColor: color,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
              }}
            />
          ))}
        </div>
        {/* 主题名称 */}
        <span
          className="text-[12px] leading-tight font-medium"
          style={{ color: 'var(--editor-text)' }}
        >
          {themeInfo.name}
        </span>
        {/* Light/Dark 标签 */}
        <span
          className="text-[10px] leading-tight mt-0.5"
          style={{ color: 'var(--editor-text-muted)' }}
        >
          {themeInfo.group === 'light' ? 'Light' : 'Dark'}
        </span>
      </button>
    );
  };

  // 面板内容（嵌入模式和浮层模式共用）
  const panelContent = (
    <div className="p-3">
      {/* 主题网格 */}
      {THEME_GROUPS.map((group) => (
        <div key={group.key} className="mb-3 last:mb-0">
          {/* 组标题 */}
          <div
            className="text-[11px] font-medium mb-2 uppercase tracking-wider"
            style={{ color: 'var(--editor-text-muted)' }}
          >
            {group.label}
          </div>
          {/* 3列网格 */}
          <div className="grid grid-cols-3 gap-2">
            {group.themeIds.map((themeId) => (
              <ThemeCardContent key={themeId} themeId={themeId} />
            ))}
          </div>
        </div>
      ))}

      {/* 分隔线 */}
      <div
        className="my-3 border-t"
        style={{ borderColor: 'var(--editor-border)' }}
      />

      {/* 跟随系统选项 */}
      <button
        className={`
          w-full flex items-center gap-2 px-2 py-2 rounded-lg
          transition-all duration-[var(--transition-fast)] cursor-pointer
          hover:bg-[var(--sidebar-hover)]
          ${isSystemSelected() ? 'ring-2 ring-[var(--accent-500)] bg-[var(--sidebar-hover)]' : ''}
        `}
        style={{
          borderWidth: isSystemSelected() ? '2px' : '0px',
          borderStyle: 'solid',
          borderColor: isSystemSelected() ? 'var(--accent-500)' : 'transparent',
        }}
        onClick={() => setTheme('system')}
      >
        <Monitor size={16} style={{ color: 'var(--editor-text-secondary)' }} />
        <span
          className="text-[13px] font-medium"
          style={{ color: 'var(--editor-text)' }}
        >
          跟随系统
        </span>
        {isSystemSelected() && (
          <span
            className="ml-auto inline-block w-4 h-4 rounded-full"
            style={{ backgroundColor: 'var(--accent-500)' }}
          >
            <svg viewBox="0 0 16 16" fill="white" className="w-4 h-4">
              <path d="M12.5 4.5L6 11l-2.5-2.5 1-1L6 9l5.5-5.5 1 1z" />
            </svg>
          </span>
        )}
      </button>

      {/* 跟随系统时的明/暗子选择器 */}
      {isSystemSelected() && (
        <div className="mt-2 space-y-2 pl-2">
          {/* 亮色主题选择 */}
          <div className="flex items-center gap-2">
            <Sun size={13} style={{ color: 'var(--editor-text-muted)' }} />
            <span className="text-[11px]" style={{ color: 'var(--editor-text-muted)' }}>亮色</span>
            <div className="flex gap-1 flex-1 justify-end">
              {THEME_GROUPS.find(g => g.key === 'light')!.themeIds.map(tid => (
                <button
                  key={tid}
                  className="rounded px-1.5 py-0.5 text-[11px] transition-all cursor-pointer"
                  style={{
                    backgroundColor: systemLightTheme === tid ? 'var(--accent-500)' : 'var(--editor-surface)',
                    color: systemLightTheme === tid ? 'white' : 'var(--editor-text-secondary)',
                    border: `1px solid ${systemLightTheme === tid ? 'var(--accent-500)' : 'var(--editor-border)'}`,
                  }}
                  onClick={() => setSystemLightTheme(tid)}
                >
                  {THEMES[tid].name}
                </button>
              ))}
            </div>
          </div>
          {/* 暗色主题选择 */}
          <div className="flex items-center gap-2">
            <Moon size={13} style={{ color: 'var(--editor-text-muted)' }} />
            <span className="text-[11px]" style={{ color: 'var(--editor-text-muted)' }}>暗色</span>
            <div className="flex gap-1 flex-1 justify-end">
              {THEME_GROUPS.find(g => g.key === 'dark')!.themeIds.map(tid => (
                <button
                  key={tid}
                  className="rounded px-1.5 py-0.5 text-[11px] transition-all cursor-pointer"
                  style={{
                    backgroundColor: systemDarkTheme === tid ? 'var(--accent-500)' : 'var(--editor-surface)',
                    color: systemDarkTheme === tid ? 'white' : 'var(--editor-text-secondary)',
                    border: `1px solid ${systemDarkTheme === tid ? 'var(--accent-500)' : 'var(--editor-border)'}`,
                  }}
                  onClick={() => setSystemDarkTheme(tid)}
                >
                  {THEMES[tid].name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // 嵌入模式：只渲染内容
  if (embedded) {
    return panelContent;
  }

  // 浮层模式：渲染浮层外壳
  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-[calc(100%+4px)] z-[100] animate-scale-in"
      style={{
        width: 280,
        borderRadius: 12,
        backgroundColor: 'var(--editor-bg)',
        border: '1px solid var(--editor-border)',
        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      }}
    >
      {panelContent}
    </div>
  );
};

export default ThemePanel;
