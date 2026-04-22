import { useThemeConfig } from "@app/providers/ThemeProvider";
import { type UiThemeId, UI_THEME_LIST } from "@app/theme/ui-theme";
import type { ChangeEvent, ReactElement } from "react";

export function ThemeSelector(): ReactElement {
  const { setUiTheme, uiTheme } = useThemeConfig();

  const onChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setUiTheme(event.target.value as UiThemeId);
  };

  return (
    <label className="field theme">
      <span>Theme</span>
      <select
        aria-label="UI theme"
        onChange={onChange}
        value={uiTheme}
      >
        {UI_THEME_LIST.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.label}
          </option>
        ))}
      </select>
    </label>
  );
}
