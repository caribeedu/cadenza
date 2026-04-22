import * as THREE from "three";

import { HIGHEST_MIDI, LOWEST_MIDI } from "../timeline";
import { visualThemeConfig, type WaterfallTheme } from "./visual-theme";

/** Deep ember; ramps toward gold with pitch. */
const EMBER = 0xff1e12;
const GOLD = 0xffcc4d;
const PITCH_SPAN = HIGHEST_MIDI - LOWEST_MIDI;

function lerpGradient(
  pitch: number,
  lowHex: number,
  highHex: number,
): THREE.Color {
  if (PITCH_SPAN <= 0) return new THREE.Color(lowHex);
  const t =
    (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) / PITCH_SPAN;
  return new THREE.Color(lowHex).lerp(new THREE.Color(highHex), t);
}

/**
 * Warm red → gold ramp by pitch (Phase A “fire” look). Only used for pending
 * notes when ``theme: 'fire'``.
 */
export function firePendingColorForPitch(pitch: number): THREE.Color {
  return lerpGradient(pitch, EMBER, GOLD);
}

export function pendingColorForTheme(
  theme: WaterfallTheme,
  pitch: number,
): THREE.Color {
  const gradient = visualThemeConfig(theme).pendingGradient;
  return lerpGradient(pitch, gradient.low, gradient.high);
}

/**
 * Top/bottom of the bar for lava-style gradient: ember at base, brighter
 * toward the “leading” (top) edge.
 */
export function fireBarGradient(pitch: number): {
  high: THREE.Color;
  low: THREE.Color;
} {
  if (PITCH_SPAN <= 0) {
    return {
      high: new THREE.Color(GOLD),
      low: new THREE.Color(EMBER),
    };
  }
  const t =
    (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) / PITCH_SPAN;
  const c0 = new THREE.Color(EMBER).lerp(new THREE.Color(GOLD), t * 0.25);
  const c1 = new THREE.Color(EMBER).lerp(new THREE.Color(GOLD), t * 0.25 + 0.65);
  return { high: c1, low: c0 };
}
