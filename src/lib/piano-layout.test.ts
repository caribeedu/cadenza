import { describe, expect, it } from "vitest";

import { computeKeyboardLayout } from "./piano-layout";
import { isBlackKey, isWhiteKey } from "./timeline";

const EPS = 1e-9;

describe("isWhiteKey / isBlackKey", () => {
  it("match a real keyboard layout", () => {
    expect(isWhiteKey(60)).toBe(true);
    expect(isBlackKey(61)).toBe(true);
    expect(isWhiteKey(62)).toBe(true);
    expect(isBlackKey(63)).toBe(true);
    expect(isWhiteKey(64)).toBe(true);
  });
});

describe("computeKeyboardLayout", () => {
  it("default C2–C7 layout contains 36 whites and 25 blacks", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    expect(L.whites).toHaveLength(36);
    expect(L.blacks).toHaveLength(25);
    expect(L.whites.length + L.blacks.length).toBe(61);
  });

  it("white key width divides total width evenly across whites", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const expected = 720 / 36;
    expect(Math.abs(L.whiteWidth - expected)).toBeLessThan(EPS);
  });

  it("lane centres line up on white key centres and black key boundaries", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const w = 720 / 36;
    expect(Math.abs(L.laneCenterPx(60) - (14 * w + w / 2))).toBeLessThan(EPS);
    expect(Math.abs(L.laneCenterPx(61) - 15 * w)).toBeLessThan(EPS);
  });
});
