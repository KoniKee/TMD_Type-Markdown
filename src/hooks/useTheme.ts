import { useEffect, useCallback, useState } from 'react';
import { useSettingsStore, THEMES } from '../stores';
import type { ThemeId, ThemeGroup } from '../stores';



function getThemeGroup(themeId: ThemeId): ThemeGroup {
  return THEMES[themeId].group;
}

export function useTheme() {
  const theme = useSettingsStore((state) => state.theme);
  const systemLightTheme = useSettingsStore((state) => state.systemLightTheme);
  const systemDarkTheme = useSettingsStore((state) => state.systemDarkTheme);
  const [effectiveThemeId, setEffectiveThemeId] = useState<ThemeId>('tian-qing');

  const updateTheme = useCallback(() => {
    let newThemeId: ThemeId;

    if (theme === 'system') {
      newThemeId = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? systemDarkTheme
        : systemLightTheme;
    } else {
      newThemeId = theme;
    }

    setEffectiveThemeId(newThemeId);

    const root = document.documentElement;
    root.setAttribute('data-theme', newThemeId);

    const group = getThemeGroup(newThemeId);
    if (group === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, systemLightTheme, systemDarkTheme]);

  useEffect(() => {
    updateTheme();
  }, [updateTheme]);

  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const newThemeId = mediaQuery.matches
        ? useSettingsStore.getState().systemDarkTheme
        : useSettingsStore.getState().systemLightTheme;
      setEffectiveThemeId(newThemeId);

      const root = document.documentElement;
      root.setAttribute('data-theme', newThemeId);

      const group = getThemeGroup(newThemeId);
      if (group === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const themeGroup = getThemeGroup(effectiveThemeId);

  return { effectiveThemeId, themeGroup };
}
