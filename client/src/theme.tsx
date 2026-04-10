import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const themes = {
  light: {
    '--bg': '#f5f0eb',
    '--panel-bg': '#ebe6e0',
    '--surface': '#fff',
    '--surface-hover': '#f0f0f0',
    '--text': '#1a1a1a',
    '--text-muted': '#666',
    '--border': 'rgba(0,0,0,0.1)',
    '--border-light': 'rgba(0,0,0,0.06)',
    '--accent': '#4361ee',
    '--accent-light': 'rgba(67,97,238,0.1)',
    '--accent-mid': 'rgba(67,97,238,0.5)',
    '--danger': '#e94560',
    '--danger-light': 'rgba(233,69,96,0.15)',
    '--top-bar': '#fff',
    '--shadow': '0 1px 4px rgba(0,0,0,0.15)',
    '--crop-color': 'rgba(220,38,38,0.6)',
    '--crop-line': 'rgba(220,38,38,0.9)',
    '--snap-color': 'rgba(220,38,38,0.5)',
    '--preview-border': 'rgba(220,38,38,0.7)',
    '--preview-bg': 'rgba(220,38,38,0.08)',
  },
  dark: {
    '--bg': '#1a1a2e',
    '--panel-bg': '#16213e',
    '--surface': '#0f3460',
    '--surface-hover': '#1a4080',
    '--text': '#e0e0e0',
    '--text-muted': '#999',
    '--border': 'rgba(255,255,255,0.1)',
    '--border-light': 'rgba(255,255,255,0.06)',
    '--accent': '#4361ee',
    '--accent-light': 'rgba(67,97,238,0.15)',
    '--accent-mid': 'rgba(67,97,238,0.5)',
    '--danger': '#e94560',
    '--danger-light': 'rgba(233,69,96,0.2)',
    '--top-bar': '#16213e',
    '--shadow': '0 1px 4px rgba(0,0,0,0.4)',
    '--crop-color': 'rgba(220,38,38,0.6)',
    '--crop-line': 'rgba(220,38,38,0.9)',
    '--snap-color': 'rgba(220,38,38,0.5)',
    '--preview-border': 'rgba(220,38,38,0.7)',
    '--preview-bg': 'rgba(220,38,38,0.08)',
  },
};

// Legacy object for components still using useTheme().theme
function toLegacy(vars: Record<string, string>) {
  return {
    bg: vars['--bg'],
    panelBg: vars['--panel-bg'],
    surface: vars['--surface'],
    text: vars['--text'],
    textMuted: vars['--text-muted'],
    border: vars['--border'],
    borderLight: vars['--border-light'],
    accent: vars['--accent'],
    danger: vars['--danger'],
    topBar: vars['--top-bar'],
  };
}

export type Theme = ReturnType<typeof toLegacy>;

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  setMode: () => {},
  theme: toLegacy(themes.light),
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('videoslide-theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  const changeMode = (m: ThemeMode) => {
    setMode(m);
    localStorage.setItem('videoslide-theme', m);
  };

  const vars = themes[mode];
  const theme = toLegacy(vars);

  // Inject CSS variables on :root
  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }
    document.body.style.background = vars['--bg'];
    document.body.style.color = vars['--text'];
  }, [vars]);

  return (
    <ThemeContext.Provider value={{ mode, setMode: changeMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
