import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  bootTheme,
  DEFAULT_THEME,
  type ThemeId,
  THEMES,
} from "../theme/theme";

export interface ThemeContextValue {
  setTheme: (theme: ThemeId) => void;
  themeRestartGeneration: number;
  theme: ThemeId;
  waterfallTheme: ThemeId;
}

const ThemeContext = createContext<null | ThemeContextValue>(null);

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [themeRestartGeneration, setThemeRestartGeneration] = useState(0);
  const skipThemeRestartBumpRef = useRef(true);
  const waterfallTheme = theme;

  const setTheme = useCallback((theme: ThemeId) => {
    if (!THEMES[theme]) return;
    setThemeState(theme);
  }, []);

  useEffect(() => {
    bootTheme(theme);
  }, [theme]);

  /** Bumps after each theme switch so the waterfall playhead resets like a session restart. */
  useEffect(() => {
    if (skipThemeRestartBumpRef.current) {
      skipThemeRestartBumpRef.current = false;
      return;
    }
    setThemeRestartGeneration((g) => g + 1);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      setTheme,
      themeRestartGeneration,
      theme,
      waterfallTheme,
    }),
    [setTheme, themeRestartGeneration, theme, waterfallTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeConfig must be used inside <ThemeProvider>");
  return ctx;
}
