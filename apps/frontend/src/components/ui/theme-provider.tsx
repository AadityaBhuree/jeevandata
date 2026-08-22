'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = 'jeevandata-theme';
const MEDIA_QUERY = '(prefers-color-scheme: dark)';

function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {
    // localStorage unavailable (private browsing, etc.)
  }
  return null;
}

function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MEDIA_QUERY).matches;
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

interface ThemeProviderProps {
  children: ReactNode;
  forcedTheme?: Theme;
}

export function ThemeProvider({ children, forcedTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => forcedTheme ?? getStoredTheme() ?? 'system');
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // Compute resolved theme from theme choice + system preference
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (theme === 'light') return 'light';
    if (theme === 'dark') return 'dark';
    return systemPrefersDark ? 'dark' : 'light';
  }, [theme, systemPrefersDark]);

  // Apply DOM class whenever resolved theme changes
  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  // Initialize systemPrefersDark to match client (override SSR false default)
  // Listen for system preference changes
  useEffect(() => {
    setSystemPrefersDark(getSystemPreference());

    const mq = window.matchMedia(MEDIA_QUERY);
    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      if (forcedTheme) return;
      if (newTheme === 'system') {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {
          /* noop */
        }
      } else {
        try {
          localStorage.setItem(STORAGE_KEY, newTheme);
        } catch {
          /* noop */
        }
      }
    },
    [forcedTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const defaultThemeValue: ThemeContextValue = {
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
};

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  return context ?? defaultThemeValue;
}
