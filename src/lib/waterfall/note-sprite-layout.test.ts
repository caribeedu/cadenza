import { describe, expect, it } from "vitest";

import {
  classifyNoteSpriteStack,
  fingerAndLabelSpriteYs,
  labelOnlySpriteY,
  resolveFingerDigit,
} from "./note-sprite-layout";
import { LAVA_STAGE_THEME } from "./theme";

const SPRITES = LAVA_STAGE_THEME.noteSprites;

describe("resolveFingerDigit", () => {
  it("accepts 1–5 inclusive", () => {
    expect(resolveFingerDigit(1)).toBe(1);
    expect(resolveFingerDigit(5)).toBe(5);
  });

  it("rejects out of range", () => {
    expect(resolveFingerDigit(0)).toBeNull();
    expect(resolveFingerDigit(6)).toBeNull();
  });
});

describe("classifyNoteSpriteStack", () => {
  it("prefers finger + label when bar is tall enough and finger exists", () => {
    expect(classifyNoteSpriteStack(40, 2, SPRITES)).toBe("finger_and_label");
  });

  it("uses label only when finger missing but bar fits label", () => {
    expect(classifyNoteSpriteStack(24, null, SPRITES)).toBe("label_only");
  });

  it("returns none when bar is too short", () => {
    expect(classifyNoteSpriteStack(10, 3, SPRITES)).toBe("none");
  });
});

describe("fingerAndLabelSpriteYs", () => {
  it("places finger below the name (smaller Y toward hit line)", () => {
    const { yFinger, yName } = fingerAndLabelSpriteYs(80, SPRITES);
    expect(yFinger).toBeLessThan(yName);
  });
});

describe("labelOnlySpriteY", () => {
  it("positions the pitch label near the bar bottom", () => {
    expect(labelOnlySpriteY(100, SPRITES)).toBe(-39);
  });
});
