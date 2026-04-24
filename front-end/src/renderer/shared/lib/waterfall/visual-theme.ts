import * as THREE from "three";
import {
  type ThemeId,
  THEMES,
  type WaterfallVisualTheme,
} from "@app/theme/theme";

/** Pending-note palette and hit-line look follows selected app theme id. */
export type WaterfallTheme = ThemeId;

// ---------------------------------------------------------------------------
// Phase A — stage (near black, soft fog so emissive/bloom stay visible)
// ---------------------------------------------------------------------------

/** Cap HiDPI multiplier for steady frame times (Phase A A4). */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/** Emissive scale on ``MeshStandardMaterial`` (bloom picks this up). */
export const EMISSIVE_PENDING = 0.26;
export const EMISSIVE_GOOD = 0.48;
export const EMISSIVE_BAD = 0.38;

export function visualThemeConfig(theme: WaterfallTheme): WaterfallVisualTheme {
  return THEMES[theme].waterfall;
}

export function feedbackForTheme(
  theme: WaterfallTheme,
  kind: "bad" | "good" | "neutral",
): THREE.Color {
  const feedback = visualThemeConfig(theme).feedback;
  if (kind === "good") return new THREE.Color(feedback.good);
  if (kind === "bad") return new THREE.Color(feedback.bad);
  return new THREE.Color(feedback.neutral);
}

/**
 * Keyboard highlight colours for CSS — keep in sync with {@link FEEDBACK}.
 * Use in `tokens.css` / `Piano.css` for cohesion with the Three.js stage
 * (plan Phase D1).
 */
export const PIANO_KEY_CSS = {
  good: "#54ffb7",
  bad: "#ff5b72",
  heatGlow: "#ff6b35",
  neutral: "#ffcb63",
} as const;
