/**
 * Waterfall stage look. **Phase A:** true-black field, fog tuned for bloom,
 * optional “fire” vs per-hand palette, warm hit line in fire mode.
 */
import * as THREE from "three";

/** Pending-note palette and hit-line look (Phase A2). */
export type WaterfallTheme = "hand" | "fire";

// ---------------------------------------------------------------------------
// Phase A — stage (near black, soft fog so emissive/bloom stay visible)
// ---------------------------------------------------------------------------

/** Near black; lets glow and bloom read clearly. */
export const BACKGROUND_COLOR = 0x020203;

/** Fog matches background; keep range wide so bars do not grey out early. */
export const FOG_COLOR = 0x010102;
export const FOG_NEAR = 450;
export const FOG_FAR = 4200;

/** Cap HiDPI multiplier for steady frame times (Phase A A4). */
export const MAX_DEVICE_PIXEL_RATIO = 2;

/**
 * UnrealBloomPass tuning. Threshold leaves dim background dark; emissive bars
 * and hit line contribute. ``resolutionScale`` shrinks the internal bloom
 * buffer for performance (Phase A A4).
 */
export const BLOOM = {
  strength: 0.88,
  radius: 0.4,
  threshold: 0.1,
  resolutionScale: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Lighting (works for both themes; fire comes mostly from note emissive)
// ---------------------------------------------------------------------------

export const AMBIENT_LIGHT = {
  color: 0x4a5568,
  intensity: 0.38,
} as const;

export const HEMI_LIGHT = {
  sky: 0x5c6a88,
  ground: 0x18151c,
  intensity: 0.45,
} as const;

/** Emissive scale on ``MeshStandardMaterial`` (bloom picks this up). */
export const EMISSIVE_PENDING = 0.26;
export const EMISSIVE_GOOD = 0.48;
export const EMISSIVE_BAD = 0.38;

/** Good / miss / tap flash — slightly warm to match the fire board. */
export const FEEDBACK = {
  good: new THREE.Color(0x40ffb0),
  bad: new THREE.Color(0xff4a62),
  neutral: new THREE.Color(0xffb84d),
} as const;

/** “Study” look: cool teal play line. */
export const HIT_LINE_HAND = {
  core: 0x00e8d0,
  glow: 0x00a090,
} as const;

/** “Fire / show” look: hot white–orange (reads through bloom). */
export const HIT_LINE_FIRE = {
  core: 0xfff2e6,
  glow: 0xff5500,
} as const;

/**
 * Keyboard highlight colours for CSS — keep in sync with {@link FEEDBACK}.
 * Use in `tokens.css` / `Piano.css` for cohesion with the Three.js stage
 * (plan Phase D1).
 */
export const PIANO_KEY_CSS = {
  good: "#40ffb0",
  bad: "#ff4a62",
  heatGlow: "#ff6b35",
  neutral: "#ffb84d",
} as const;
