import type { KeyboardLayout, KeySlot } from "../types/geometry";

import { isAccidental } from "./timeline";

const DEFAULT_BLACK_WIDTH_RATIO = 0.6;

export function isBlackKey(pitch: number): boolean {
  return isAccidental(pitch);
}

export function isWhiteKey(pitch: number): boolean {
  return !isAccidental(pitch);
}

export interface KeyboardLayoutOptions {
  blackWidthRatio?: number;
  high: number;
  low: number;
  totalWidthPx: number;
}

export function computeKeyboardLayout({
  blackWidthRatio = DEFAULT_BLACK_WIDTH_RATIO,
  high,
  low,
  totalWidthPx,
}: KeyboardLayoutOptions): KeyboardLayout {
  if (!(high > low)) throw new Error("high must be greater than low");
  if (!(totalWidthPx > 0)) throw new Error("totalWidthPx must be positive");

  const whitePitches: number[] = [];
  for (let p = low; p <= high; ++p) {
    if (isWhiteKey(p)) whitePitches.push(p);
  }
  if (whitePitches.length === 0) {
    throw new Error("range contains no white keys");
  }

  const whiteWidth = totalWidthPx / whitePitches.length;
  const blackWidth = whiteWidth * blackWidthRatio;

  const whiteIndexByPitch = new Map<number, number>();
  const whites: KeySlot[] = whitePitches.map((pitch, idx) => {
    whiteIndexByPitch.set(pitch, idx);
    return {
      pitch,
      width: whiteWidth,
      xCenter: idx * whiteWidth + whiteWidth / 2,
      xLeft: idx * whiteWidth,
    };
  });

  const blacks: KeySlot[] = [];
  for (let p = low; p <= high; ++p) {
    if (!isBlackKey(p)) continue;
    const leftIdx = whiteIndexByPitch.get(p - 1);
    if (leftIdx === undefined) continue;
    const xCenter = (leftIdx + 1) * whiteWidth;
    blacks.push({
      pitch: p,
      width: blackWidth,
      xCenter,
      xLeft: xCenter - blackWidth / 2,
    });
  }

  const firstWhiteCenter = whiteWidth / 2;
  const lastWhiteCenter =
    (whitePitches.length - 1) * whiteWidth + whiteWidth / 2;

  function laneCenterPx(pitch: number): number {
    if (isWhiteKey(pitch)) {
      const idx = whiteIndexByPitch.get(pitch);
      if (idx !== undefined) return idx * whiteWidth + whiteWidth / 2;
      return pitch < low ? firstWhiteCenter : lastWhiteCenter;
    }
    const leftIdx = whiteIndexByPitch.get(pitch - 1);
    if (leftIdx !== undefined) return (leftIdx + 1) * whiteWidth;
    return pitch < low ? firstWhiteCenter : lastWhiteCenter;
  }

  function laneWidthPx(pitch: number): number {
    return isWhiteKey(pitch) ? whiteWidth : blackWidth;
  }

  return {
    blacks,
    blackWidth,
    high,
    laneCenterPx,
    laneWidthPx,
    low,
    totalWidthPx,
    whites,
    whiteWidth,
  };
}
