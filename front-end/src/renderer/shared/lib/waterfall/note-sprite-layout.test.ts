import { DEFAULT_UI_THEME, UI_THEMES } from "@app/theme/ui-theme";
import { describe, expect, it } from "vitest";

const DEFAULT_NOTE_SPRITES =
  UI_THEMES[DEFAULT_UI_THEME].waterfall.noteSprites;

import {
  classifyNoteSpriteStack,
  fingerAndLabelSpriteYs,
  labelOnlySpriteY,
  resolveFingerDigit,
} from "./note-sprite-layout";

describe("resolveFingerDigit", () => {
  it("accepts 1–5 inclusive", () => {
    expect(resolveFingerDigit(1)).toBe(1);
    expect(resolveFingerDigit(5)).toBe(5);
    expect(resolveFingerDigit(-3)).toBe(3);
  });

  it("rejects out of range and non-finite", () => {
    expect(resolveFingerDigit(0)).toBeNull();
    expect(resolveFingerDigit(6)).toBeNull();
    expect(resolveFingerDigit(null)).toBeNull();
    expect(resolveFingerDigit(undefined)).toBeNull();
    expect(resolveFingerDigit(Number.NaN)).toBeNull();
  });
});

describe("classifyNoteSpriteStack", () => {
  const s = DEFAULT_NOTE_SPRITES;

  it("prefers finger + label when bar is tall enough and finger exists", () => {
    expect(classifyNoteSpriteStack(40, 2, s)).toBe("finger_and_label");
  });

  it("uses label only when finger missing but bar fits label", () => {
    expect(classifyNoteSpriteStack(24, null, s)).toBe("label_only");
  });

  it("returns none when bar is too short", () => {
    expect(classifyNoteSpriteStack(10, 3, s)).toBe("none");
  });
});

describe("fingerAndLabelSpriteYs", () => {
  it("places finger below the name (smaller Y toward hit line)", () => {
    const h = 80;
    const { yFinger, yName } = fingerAndLabelSpriteYs(h, DEFAULT_NOTE_SPRITES);
    expect(yFinger).toBeLessThan(yName);
  });
});

describe("labelOnlySpriteY", () => {
  it("positions the pitch label near the bar bottom (label-only stack)", () => {
    const s = DEFAULT_NOTE_SPRITES;
    // -h/2 + LABEL_HEIGHT/2 + LABEL_BOTTOM_INSET for h=100 → -39
    expect(labelOnlySpriteY(100, s)).toBe(-39);
  });
});
