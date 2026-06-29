import { describe, expect, it } from "vitest";
import { fireBarGradient, pendingColorForTheme } from "./fire-pending-color";
import { getWaterfallTheme, WATERFALL_THEME_IDS } from "./theme";

describe("fire-pending-color", () => {
  const lava = getWaterfallTheme(WATERFALL_THEME_IDS.LavaStage);

  it("lerps low pitch toward gradient low", () => {
    const low = pendingColorForTheme(lava, 21);
    const high = pendingColorForTheme(lava, 108);
    expect(low.getHex()).not.toBe(high.getHex());
  });

  it("returns distinct bar gradient stops", () => {
    const g = fireBarGradient(60, lava);
    expect(g.low.getHex()).not.toBe(g.high.getHex());
  });
});
