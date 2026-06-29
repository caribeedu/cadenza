import * as THREE from "three";
import { HIGHEST_MIDI, LOWEST_MIDI } from "../timeline";
import type { WaterfallTheme } from "./theme";

const PITCH_SPAN = HIGHEST_MIDI - LOWEST_MIDI;

function lerpGradient(pitch: number, lowHex: number, highHex: number): THREE.Color {
  if (PITCH_SPAN <= 0) return new THREE.Color(lowHex);
  const t =
    (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) / PITCH_SPAN;
  return new THREE.Color(lowHex).lerp(new THREE.Color(highHex), t);
}

export function pendingColorForTheme(theme: WaterfallTheme, pitch: number): THREE.Color {
  const gradient = theme.pendingGradient;
  return lerpGradient(pitch, gradient.low, gradient.high);
}

export function fireBarGradient(
  pitch: number,
  theme: WaterfallTheme,
): { high: THREE.Color; low: THREE.Color } {
  const { high: highHex, low: lowHex } = theme.pendingGradient;
  if (PITCH_SPAN <= 0) {
    return { high: new THREE.Color(highHex), low: new THREE.Color(lowHex) };
  }
  const t =
    (Math.max(LOWEST_MIDI, Math.min(HIGHEST_MIDI, pitch)) - LOWEST_MIDI) / PITCH_SPAN;
  const cLow = new THREE.Color(lowHex);
  const cHigh = new THREE.Color(highHex);
  return {
    high: cLow.clone().lerp(cHigh, t * 0.25 + 0.65),
    low: cLow.clone().lerp(cHigh, t * 0.25),
  };
}
