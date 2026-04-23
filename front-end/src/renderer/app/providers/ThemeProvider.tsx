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
  DEFAULT_UI_THEME,
  type UiThemeId,
  UI_THEMES,
} from "../theme/ui-theme";

export interface ThemeContextValue {
  setUiTheme: (theme: UiThemeId) => void;
  themeRestartGeneration: number;
  uiTheme: UiThemeId;
  waterfallTheme: UiThemeId;
}

const ThemeContext = createContext<null | ThemeContextValue>(null);

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [uiTheme, setUiThemeState] = useState<UiThemeId>(DEFAULT_UI_THEME);
  const [themeRestartGeneration, setThemeRestartGeneration] = useState(0);
  const skipThemeRestartBumpRef = useRef(true);
  const waterfallTheme = uiTheme;

  const setUiTheme = useCallback((theme: UiThemeId) => {
    if (!UI_THEMES[theme]) return;
    setUiThemeState(theme);
  }, []);

  useEffect(() => {
    bootTheme(uiTheme);
  }, [uiTheme]);

  /** Bumps after each theme switch so the waterfall playhead resets like a session restart. */
  useEffect(() => {
    if (skipThemeRestartBumpRef.current) {
      skipThemeRestartBumpRef.current = false;
      return;
    }
    setThemeRestartGeneration((g) => g + 1);
  }, [uiTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      setUiTheme,
      themeRestartGeneration,
      uiTheme,
      waterfallTheme,
    }),
    [setUiTheme, themeRestartGeneration, uiTheme, waterfallTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeConfig(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeConfig must be used inside <ThemeProvider>");
  return ctx;
}
