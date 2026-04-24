import { useThemeConfig } from "@app/providers/ThemeProvider";
import { type ThemeId, THEME_LIST } from "@app/theme/theme";
import type { ChangeEvent, ReactElement } from "react";

export function ThemeSelector(): ReactElement {
  const { setTheme, theme } = useThemeConfig();

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setTheme(event.target.value as ThemeId);
  };

  return (
    <label className="field theme">
      <span>Theme</span>
      <select
        aria-label="UI theme"
        onChange={onChange}
        value={theme}
      >
        {THEME_LIST.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
}
