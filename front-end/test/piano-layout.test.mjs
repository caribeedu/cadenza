import test from "node:test";
import assert from "node:assert/strict";

import {
  computeKeyboardLayout,
  isBlackKey,
  isWhiteKey,
} from "../src/renderer/piano-layout.js";

const EPS = 1e-9;

test("isWhiteKey / isBlackKey match a real keyboard layout", () => {
  assert.equal(isWhiteKey(60), true);  // C4
  assert.equal(isBlackKey(61), true);  // C♯4
  assert.equal(isWhiteKey(62), true);  // D4
  assert.equal(isBlackKey(63), true);  // D♯4
  assert.equal(isWhiteKey(64), true);  // E4 (no black between E and F)
  assert.equal(isWhiteKey(65), true);  // F4
  assert.equal(isBlackKey(66), true);  // F♯4
  assert.equal(isWhiteKey(71), true);  // B4 (no black between B and C)
});

test("default C2–C7 layout contains 36 whites and 25 blacks", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  assert.equal(L.whites.length, 36);
  assert.equal(L.blacks.length, 25);
  assert.equal(L.whites.length + L.blacks.length, 61);
});

test("white key width divides total width evenly across whites", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const expected = 720 / 36;
  assert.ok(Math.abs(L.whiteWidth - expected) < EPS);
  for (const w of L.whites) assert.ok(Math.abs(w.width - expected) < EPS);
});

test("black keys are 0.6× white width by default", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const expected = (720 / 36) * 0.6;
  assert.ok(Math.abs(L.blackWidth - expected) < EPS);
});

test("laneCenterPx for middle C lands on the C4 white key's centre", () => {
  // C2 is MIDI 36, C4 is MIDI 60. C4 is the 14th white from C2 (14 whites
  // per 2 octaves — 7×2), i.e. index 14.
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const w = 720 / 36;
  const expected = 14 * w + w / 2;
  assert.ok(Math.abs(L.laneCenterPx(60) - expected) < EPS);
});

test("laneCenterPx for a black key sits exactly on the neighbouring whites' boundary", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const w = 720 / 36;
  // C♯4 (MIDI 61): left white is C4 (white index 14), so boundary at 15w.
  assert.ok(Math.abs(L.laneCenterPx(61) - 15 * w) < EPS);
  // F♯4 (MIDI 66): left white is F4 (white index 17), so boundary at 18w.
  assert.ok(Math.abs(L.laneCenterPx(66) - 18 * w) < EPS);
});

test("laneWidthPx distinguishes white and black widths", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const w = 720 / 36;
  assert.ok(Math.abs(L.laneWidthPx(60) - w) < EPS);
  assert.ok(Math.abs(L.laneWidthPx(61) - w * 0.6) < EPS);
});

test("laneCenterPx clamps out-of-range pitches to the edge", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720 });
  const w = 720 / 36;
  // Below range → first white centre.
  assert.ok(Math.abs(L.laneCenterPx(21) - w / 2) < EPS);
  // Above range → last white centre (C7 is the highest white, index 35).
  assert.ok(Math.abs(L.laneCenterPx(120) - (35 * w + w / 2)) < EPS);
});

test("a custom blackWidthRatio propagates through the layout", () => {
  const L = computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 720, blackWidthRatio: 0.5 });
  const w = 720 / 36;
  assert.ok(Math.abs(L.blackWidth - w * 0.5) < EPS);
  assert.ok(Math.abs(L.laneWidthPx(61) - w * 0.5) < EPS);
});

test("computeKeyboardLayout rejects degenerate inputs", () => {
  assert.throws(() => computeKeyboardLayout({ low: 60, high: 60, totalWidthPx: 100 }));
  assert.throws(() => computeKeyboardLayout({ low: 60, high: 50, totalWidthPx: 100 }));
  assert.throws(() => computeKeyboardLayout({ low: 36, high: 96, totalWidthPx: 0 }));
});

test("a 1-octave C4–C5 layout: 8 whites (C..C), 5 blacks", () => {
  const L = computeKeyboardLayout({ low: 60, high: 72, totalWidthPx: 400 });
  assert.equal(L.whites.length, 8);
  assert.equal(L.blacks.length, 5);
});
