import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';

const themes = {
  light: {
    bg: '#f5f0eb',
    panelBg: '#ebe6e0',
    surface: '#fff',
    text: '#1a1a1a',
    textMuted: '#666',
    border: 'rgba(0,0,0,0.1)',
    borderLight: 'rgba(0,0,0,0.06)',
    accent: '#4361ee',
    danger: '#e94560',
    topBar: '#fff',
  },
  dark: {
    bg: '#1a1a2e',
    panelBg: '#16213e',
    surface: '#0f3460',
    text: '#e0e0e0',
    textMuted: '#999',
    border: 'rgba(255,255,255,0.1)',
    borderLight: 'rgba(255,255,255,0.06)',
    accent: '#4361ee',
    danger: '#e94560',
    topBar: '#16213e',
  },
};

export type Theme = typeof themes.light;

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  setMode: () => {},
  theme: themes.light,
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

  const theme = themes[mode];

  // Apply to body
  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ mode, setMode: changeMode, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
