import { getWaterfallTheme, type WaterfallThemeId } from "./waterfall/theme";

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** Sync piano key flash colors with the active waterfall theme. */
export function applyPianoThemeVars(themeId: WaterfallThemeId): void {
  const theme = getWaterfallTheme(themeId);
  const root = document.documentElement;
  root.style.setProperty("--piano-good", hex(theme.feedback.good));
  root.style.setProperty("--piano-bad", hex(theme.feedback.bad));
  root.style.setProperty("--piano-neutral", hex(theme.feedback.neutral));
  root.style.setProperty("--piano-heat", hex(theme.bloom.tint));
}
