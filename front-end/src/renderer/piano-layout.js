// Pure geometric layout for a piano keyboard. DOM-free so the math can be
// unit-tested under `node --test` without pulling jsdom.
//
// The output is consumed by two places:
//   1. `piano.js` renders the SVG keys.
//   2. `waterfall.js` positions its falling bars via `laneCenterPx` /
//      `laneWidthPx` so the lanes sit exactly above their keys — black
//      keys are narrower than whites, the waterfall should be too.
//
// Geometry rules follow a real piano:
//   - 7 whites + 5 blacks per octave.
//   - Each white gets a full-width slot (totalWidth / whiteCount).
//   - Each black sits centred on the boundary between its two neighbouring
//     whites, with width = `blackWidthRatio` × whiteWidth (0.6 by default,
//     matches IMP-02's "~60% the width" specification).
//   - Semitones with no left white in the range (none in a C2-C7 layout,
//     but guarded anyway) are skipped from the black list.

import { isAccidental } from "./timeline.js";

const DEFAULT_BLACK_WIDTH_RATIO = 0.6;

export function isBlackKey(pitch) {
  return isAccidental(pitch);
}

export function isWhiteKey(pitch) {
  return !isAccidental(pitch);
}

/**
 * Build a layout for a keyboard spanning `[low, high]` (both inclusive),
 * occupying `totalWidthPx` horizontally.
 *
 * Returned callables (`laneCenterPx`, `laneWidthPx`) clamp out-of-range
 * pitches to the nearest edge so the waterfall can still render them
 * rather than crashing on a lookup miss.
 */
export function computeKeyboardLayout({
  low,
  high,
  totalWidthPx,
  blackWidthRatio = DEFAULT_BLACK_WIDTH_RATIO,
}) {
  if (!(high > low)) throw new Error("high must be greater than low");
  if (!(totalWidthPx > 0)) throw new Error("totalWidthPx must be positive");

  const whitePitches = [];
  for (let p = low; p <= high; ++p) {
    if (isWhiteKey(p)) whitePitches.push(p);
  }
  if (whitePitches.length === 0) {
    throw new Error("range contains no white keys");
  }

  const whiteWidth = totalWidthPx / whitePitches.length;
  const blackWidth = whiteWidth * blackWidthRatio;

  const whiteIndexByPitch = new Map();
  const whites = whitePitches.map((pitch, idx) => {
    whiteIndexByPitch.set(pitch, idx);
    return {
      pitch,
      xLeft: idx * whiteWidth,
      xCenter: idx * whiteWidth + whiteWidth / 2,
      width: whiteWidth,
    };
  });

  const blacks = [];
  for (let p = low; p <= high; ++p) {
    if (!isBlackKey(p)) continue;
    const leftIdx = whiteIndexByPitch.get(p - 1);
    if (leftIdx === undefined) continue;
    const xCenter = (leftIdx + 1) * whiteWidth;
    blacks.push({
      pitch: p,
      xLeft: xCenter - blackWidth / 2,
      xCenter,
      width: blackWidth,
    });
  }

  const firstWhiteCenter = whiteWidth / 2;
  const lastWhiteCenter = (whitePitches.length - 1) * whiteWidth + whiteWidth / 2;

  function laneCenterPx(pitch) {
    if (isWhiteKey(pitch)) {
      const idx = whiteIndexByPitch.get(pitch);
      if (idx !== undefined) return idx * whiteWidth + whiteWidth / 2;
      return pitch < low ? firstWhiteCenter : lastWhiteCenter;
    }
    const leftIdx = whiteIndexByPitch.get(pitch - 1);
    if (leftIdx !== undefined) return (leftIdx + 1) * whiteWidth;
    return pitch < low ? firstWhiteCenter : lastWhiteCenter;
  }

  function laneWidthPx(pitch) {
    return isWhiteKey(pitch) ? whiteWidth : blackWidth;
  }

  return {
    low,
    high,
    whiteWidth,
    blackWidth,
    whites,
    blacks,
    totalWidthPx,
    laneCenterPx,
    laneWidthPx,
  };
}
