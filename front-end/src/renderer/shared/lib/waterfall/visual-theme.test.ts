import { describe, expect, it } from "vitest";

import { feedbackForTheme, visualThemeConfig } from "./visual-theme";

describe("waterfall visual themes", () => {
  it("provides per-theme stage and bloom configs", () => {
    const aurora = visualThemeConfig("aurora-ice");
    const dark = visualThemeConfig("cadenza-dark");
    expect(aurora.background).not.toBe(dark.background);
    expect(aurora.bloom.strength).not.toBe(dark.bloom.strength);
    expect(aurora.bloom.tint).not.toBe(dark.bloom.tint);
  });

  it("provides per-theme feedback colors", () => {
    const darkNeutral = feedbackForTheme("cadenza-dark", "neutral").getHex();
    const lightNeutral = feedbackForTheme("cadenza-light", "neutral").getHex();
    expect(darkNeutral).not.toBe(lightNeutral);
  });
});
