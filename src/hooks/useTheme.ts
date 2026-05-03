import { useEffect, useCallback, useState } from 'react';
import { useSettingsStore } from '../stores';

type Theme = 'light' | 'dark' | 'system';

/**
 * 主题管理 Hook
 * 读取设置中的主题配置，监听系统主题变化，动态切换 dark class
 * 
 * @returns 当前生效的主题（light 或 dark）
 * 
 * @example
 * ```tsx
 * function App() {
 *   const effectiveTheme = useTheme();
 *   return <div className={effectiveTheme}>Content</div>;
 * }
 * ```
 */
export function useTheme(): 'light' | 'dark' {
  const theme = useSettingsStore((state) => state.theme);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  /**
   * 更新有效主题
   * 根据设置的主题和系统偏好计算最终主题
   */
  const updateEffectiveTheme = useCallback(() => {
    let newTheme: 'light' | 'dark';
    
    if (theme === 'system') {
      // 跟随系统主题
      newTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } else {
      // 使用用户设置的主题
      newTheme = theme;
    }
    
    setEffectiveTheme(newTheme);
    
    // 更新 DOM 的 class
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // 主题变化时更新
  useEffect(() => {
    updateEffectiveTheme();
  }, [updateEffectiveTheme]);

  // 监听系统主题变化（仅在跟随系统模式时生效）
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // 处理系统主题变化
    const handleChange = (event: MediaQueryListEvent) => {
      const newTheme = event.matches ? 'dark' : 'light';
      setEffectiveTheme(newTheme);
      
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    // 添加监听器
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  return effectiveTheme;
}