import * as THREE from "three";

import { HIGHEST_MIDI, LOWEST_MIDI } from "../timeline";

/** Deep ember; ramps toward gold with pitch. */
const EMBER = 0xff1e12;
const GOLD = 0xffcc4d;
const PITCH_SPAN = HIGHEST_MIDI - LOWEST_MIDI;

/**
 * Warm red → gold ramp by pitch (Phase A “fire” look). Only used for pending
 * notes when ``theme: 'fire'``.
 */
export function firePendingColorForPitch(pitch: number): THREE.Color {
  if (PITCH_SPAN <= 0) return new THREE.Color(EMBER);
  const t = (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) / PITCH_SPAN;
  return new THREE.Color(EMBER).lerp(new THREE.Color(GOLD), t);
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
