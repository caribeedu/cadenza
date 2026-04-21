import { describe, expect, it } from "vitest";

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
  it("prefers finger + label when bar is tall enough and finger exists", () => {
    expect(classifyNoteSpriteStack(40, 2)).toBe("finger_and_label");
  });

  it("uses label only when finger missing but bar fits label", () => {
    expect(classifyNoteSpriteStack(24, null)).toBe("label_only");
  });

  it("returns none when bar is too short", () => {
    expect(classifyNoteSpriteStack(10, 3)).toBe("none");
  });
});

describe("fingerAndLabelSpriteYs", () => {
  it("places finger below the name (smaller Y toward hit line)", () => {
    const h = 80;
    const { yFinger, yName } = fingerAndLabelSpriteYs(h);
    expect(yFinger).toBeLessThan(yName);
  });
});

describe("labelOnlySpriteY", () => {
  it("positions the pitch label near the bar bottom (label-only stack)", () => {
    // -h/2 + LABEL_HEIGHT/2 + LABEL_BOTTOM_INSET for h=100 → -39
    expect(labelOnlySpriteY(100)).toBe(-39);
  });
});
