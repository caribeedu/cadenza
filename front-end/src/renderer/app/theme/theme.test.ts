import { describe, expect, it } from "vitest";

import { DEFAULT_THEME, THEME_IDS, THEMES } from "./theme";

describe("ui theme registry", () => {
  it("keeps all core token categories in every theme", () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.vars["--bg"]).toBeTruthy();
      expect(theme.vars["--panel"]).toBeTruthy();
      expect(theme.vars["--dur-fast"]).toBeTruthy();
      expect(theme.vars["--radius-md"]).toBeTruthy();
      expect(theme.vars["--piano-height"]).toBeTruthy();
      expect(theme.vars["--btn-accent-bg-start"]).toBeTruthy();
      expect(theme.vars["--range-track"]).toBeTruthy();
      expect(theme.vars["--range-thumb"]).toBeTruthy();
      expect(theme.vars["--chip-on-bg"]).toBeTruthy();
      expect(theme.vars["--chip-err-bg"]).toBeTruthy();
      expect(theme.vars["--timeline-bg"]).toBeTruthy();
      expect(theme.vars["--timeline-border"]).toBeTruthy();
      expect(theme.vars["--timeline-bin"]).toBeTruthy();
      expect(theme.vars["--timeline-thumb"]).toBeTruthy();
    }
  });

  it("uses lava-stage as default", () => {
    expect(DEFAULT_THEME).toBe(THEME_IDS.LavaStage);
  });

  it("ships meaningfully different palettes", () => {
    expect(THEMES[THEME_IDS.AuroraIce].vars["--bg"]).not.toBe(
      THEMES[THEME_IDS.LavaStage].vars["--bg"],
    );
    expect(THEMES[THEME_IDS.AuroraIce].vars["--accent"]).not.toBe(
      THEMES[THEME_IDS.LavaStage].vars["--accent"],
    );
  });

  it("keeps waterfall config embedded in each ui theme", () => {
    expect(THEMES[THEME_IDS.LavaStage].waterfall.lavaBars).toBe(true);
    expect(THEMES[THEME_IDS.AuroraIce].waterfall.hitLine.glow).toBeTruthy();
    expect(THEMES[THEME_IDS.AuroraIce].waterfall.pendingGradient.high).toBeTruthy();
    expect(THEMES[THEME_IDS.AuroraIce].waterfall.pendingColorMode).toBe("staff");
    for (const theme of Object.values(THEMES)) {
      expect(theme.waterfall.backdrop.deep).toBeGreaterThan(0);
      expect(theme.waterfall.backdrop.mid).toBeGreaterThan(0);
      expect(theme.waterfall.backdrop.glow).toBeGreaterThan(0);
      expect(theme.waterfall.lavaAppearance.handLeftTint).toBeGreaterThan(0);
      expect(theme.waterfall.lavaAppearance.handRightTint).toBeGreaterThan(0);
      expect(theme.waterfall.lavaAppearance.handTintMix).toBeGreaterThan(0);
      expect(theme.waterfall.lavaAppearance.handTintMix).toBeLessThanOrEqual(1);
      expect(theme.waterfall.particles.tint).toBeGreaterThan(0);
      expect(theme.waterfall.particles.size).toBeGreaterThan(0);
      expect(theme.waterfall.particles.opacity).toBeGreaterThan(0);
      expect(theme.waterfall.noteBarGeometry.depth).toBeGreaterThan(0);
      expect(theme.waterfall.noteSprites.labelWidthPx).toBeGreaterThan(0);
      expect(theme.waterfall.lavaAppearance.mixGood).toBeGreaterThan(0);
    }
  });
});
