import {
  computeKeyboardLayout,
  isBlackKey,
  isWhiteKey,
} from "@shared/lib/piano-layout";
import { describe, expect, it } from "vitest";

const EPS = 1e-9;

describe("isWhiteKey / isBlackKey", () => {
  it("match a real keyboard layout", () => {
    expect(isWhiteKey(60)).toBe(true);
    expect(isBlackKey(61)).toBe(true);
    expect(isWhiteKey(62)).toBe(true);
    expect(isBlackKey(63)).toBe(true);
    expect(isWhiteKey(64)).toBe(true);
    expect(isWhiteKey(65)).toBe(true);
    expect(isBlackKey(66)).toBe(true);
    expect(isWhiteKey(71)).toBe(true);
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
    for (const w of L.whites)
      expect(Math.abs(w.width - expected)).toBeLessThan(EPS);
  });

  it("black keys are 0.6× white width by default", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const expected = (720 / 36) * 0.6;
    expect(Math.abs(L.blackWidth - expected)).toBeLessThan(EPS);
  });

  it("lane centres line up on white key centres and black key boundaries", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const w = 720 / 36;
    expect(Math.abs(L.laneCenterPx(60) - (14 * w + w / 2))).toBeLessThan(EPS);
    expect(Math.abs(L.laneCenterPx(61) - 15 * w)).toBeLessThan(EPS);
    expect(Math.abs(L.laneCenterPx(66) - 18 * w)).toBeLessThan(EPS);
  });

  it("laneWidthPx distinguishes white and black widths", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const w = 720 / 36;
    expect(Math.abs(L.laneWidthPx(60) - w)).toBeLessThan(EPS);
    expect(Math.abs(L.laneWidthPx(61) - w * 0.6)).toBeLessThan(EPS);
  });

  it("clamps out-of-range pitches to the edges", () => {
    const L = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const w = 720 / 36;
    expect(Math.abs(L.laneCenterPx(21) - w / 2)).toBeLessThan(EPS);
    expect(Math.abs(L.laneCenterPx(120) - (35 * w + w / 2))).toBeLessThan(EPS);
  });

  it("propagates a custom blackWidthRatio", () => {
    const L = computeKeyboardLayout({
      blackWidthRatio: 0.5,
      high: 96,
      low: 36,
      totalWidthPx: 720,
    });
    const w = 720 / 36;
    expect(Math.abs(L.blackWidth - w * 0.5)).toBeLessThan(EPS);
    expect(Math.abs(L.laneWidthPx(61) - w * 0.5)).toBeLessThan(EPS);
  });

  it("rejects degenerate inputs", () => {
    expect(() =>
      computeKeyboardLayout({ high: 60, low: 60, totalWidthPx: 100 }),
    ).toThrow();
    expect(() =>
      computeKeyboardLayout({ high: 50, low: 60, totalWidthPx: 100 }),
    ).toThrow();
    expect(() =>
      computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 0 }),
    ).toThrow();
  });

  it("C4–C5 layout has 8 whites, 5 blacks", () => {
    const L = computeKeyboardLayout({ high: 72, low: 60, totalWidthPx: 400 });
    expect(L.whites).toHaveLength(8);
    expect(L.blacks).toHaveLength(5);
  });
});
