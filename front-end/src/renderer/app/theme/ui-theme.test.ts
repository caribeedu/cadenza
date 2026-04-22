import { describe, expect, it } from "vitest";

import { DEFAULT_UI_THEME, UI_THEME_IDS, UI_THEMES } from "./ui-theme";

describe("ui theme registry", () => {
  it("keeps all core token categories in every theme", () => {
    for (const theme of Object.values(UI_THEMES)) {
      expect(theme.vars["--bg"]).toBeTruthy();
      expect(theme.vars["--panel"]).toBeTruthy();
      expect(theme.vars["--dur-fast"]).toBeTruthy();
      expect(theme.vars["--radius-md"]).toBeTruthy();
      expect(theme.vars["--piano-height"]).toBeTruthy();
      expect(theme.vars["--piano-host-bg"]).toBeTruthy();
      expect(theme.vars["--btn-accent-bg-start"]).toBeTruthy();
    }
  });

  it("uses cadenza-dark as default", () => {
    expect(DEFAULT_UI_THEME).toBe(UI_THEME_IDS.CadenzaDark);
  });

  it("ships meaningfully different palettes", () => {
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].vars["--bg"]).not.toBe(
      UI_THEMES[UI_THEME_IDS.CadenzaLight].vars["--bg"],
    );
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].vars["--accent"]).not.toBe(
      UI_THEMES[UI_THEME_IDS.LavaStage].vars["--accent"],
    );
  });

  it("keeps waterfall config embedded in each ui theme", () => {
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].waterfall).toBeTruthy();
    expect(UI_THEMES[UI_THEME_IDS.CadenzaLight].waterfall.lavaBars).toBe(false);
    expect(UI_THEMES[UI_THEME_IDS.LavaStage].waterfall.lavaBars).toBe(true);
    expect(UI_THEMES[UI_THEME_IDS.AuroraIce].waterfall.hitLine.glow).toBeTruthy();
    expect(UI_THEMES[UI_THEME_IDS.SunsetPaper].waterfall.bloom.strength).toBeTruthy();
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].waterfall.pendingGradient.low).toBeTruthy();
    expect(UI_THEMES[UI_THEME_IDS.CadenzaLight].waterfall.pendingGradient.high).toBeTruthy();
    expect(UI_THEMES[UI_THEME_IDS.CadenzaLight].waterfall.pendingColorMode).toBe("staff");
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].waterfall.pendingColorMode).toBe("gradient");
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].waterfall.hitLine.glowOpacity).toBeGreaterThan(0);
    expect(UI_THEMES[UI_THEME_IDS.CadenzaDark].waterfall.hitLine.glowThickness).toBeGreaterThan(0);
  });
});
