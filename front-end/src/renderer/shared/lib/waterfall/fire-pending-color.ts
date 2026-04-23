import * as THREE from "three";

import { HIGHEST_MIDI, LOWEST_MIDI } from "../timeline";
import { visualThemeConfig, type WaterfallTheme } from "./visual-theme";

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

export function pendingColorForTheme(
  theme: WaterfallTheme,
  pitch: number,
): THREE.Color {
  const gradient = visualThemeConfig(theme).pendingGradient;
  return lerpGradient(pitch, gradient.low, gradient.high);
}

/**
 * Top/bottom of the lava bar: theme ``pendingGradient`` low→high, palette comes from the active theme.
 */
export function fireBarGradient(
  pitch: number,
  theme: WaterfallTheme,
): {
  high: THREE.Color;
  low: THREE.Color;
} {
  const { high: highHex, low: lowHex } =
    visualThemeConfig(theme).pendingGradient;
  if (PITCH_SPAN <= 0) {
    return {
      high: new THREE.Color(highHex),
      low: new THREE.Color(lowHex),
    };
  }
  const t =
    (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) /
    PITCH_SPAN;
  const cLow = new THREE.Color(lowHex);
  const cHigh = new THREE.Color(highHex);
  const c0 = cLow.clone().lerp(cHigh, t * 0.25);
  const c1 = cLow.clone().lerp(cHigh, t * 0.25 + 0.65);
  return { high: c1, low: c0 };
}
