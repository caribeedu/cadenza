import { getWaterfallTheme, type WaterfallThemeId } from "./waterfall/theme";

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

/** Sync piano key flash colors and UI accent vars with the active waterfall theme. */
export function applyPianoThemeVars(themeId: WaterfallThemeId): void {
  const theme = getWaterfallTheme(themeId);
  const root = document.documentElement;
  root.style.setProperty("--piano-good", hex(theme.feedback.good));
  root.style.setProperty("--piano-bad", hex(theme.feedback.bad));
  root.style.setProperty("--piano-neutral", hex(theme.feedback.neutral));
  root.style.setProperty("--piano-heat", hex(theme.bloom.tint));
  root.style.setProperty("--accent", hex(theme.bloom.tint));
  root.style.setProperty("--accent-secondary", hex(theme.backdrop.glow));
  root.style.setProperty(
    "--accent-glow",
    `${hex(theme.bloom.tint)}59`,
  );
  root.style.setProperty(
    "--accent-muted",
    `${hex(theme.bloom.tint)}26`,
  );
  root.style.setProperty(
    "--border-accent",
    `${hex(theme.bloom.tint)}66`,
  );
  root.style.setProperty("--scrubber-bin", `${hex(theme.pendingGradient.high)}8c`);
  root.style.setProperty("--scrubber-track", `${hex(theme.background)}d9`);
  root.style.setProperty("--scrubber-border", `${hex(theme.bloom.tint)}40`);
  root.style.setProperty("--scrubber-thumb", hex(theme.bloom.tint));
  root.style.setProperty("--scrubber-thumb-glow", `${hex(theme.bloom.tint)}cc`);
}
