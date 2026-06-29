export const MAX_DEVICE_PIXEL_RATIO = 2;

export const EMISSIVE_PENDING = 0.26;
export const EMISSIVE_GOOD = 0.48;
export const EMISSIVE_BAD = 0.38;

export const WATERFALL_THEME_IDS = {
  LavaStage: "lava-stage",
  AuroraIce: "aurora-ice",
} as const;

export type WaterfallThemeId =
  (typeof WATERFALL_THEME_IDS)[keyof typeof WATERFALL_THEME_IDS];

export interface LavaAppearance {
  handLeftTint: number;
  handRightTint: number;
  handTintMix: number;
  mixBad: number;
  mixGood: number;
  noiseTimeScale: number;
  noiseUvScaleX: number;
  noiseUvScaleY: number;
  noiseValueAmp: number;
  noiseValueBase: number;
}

export interface WaterfallTheme {
  ambientLight: { color: number; intensity: number };
  backdrop: { deep: number; glow: number; mid: number };
  background: number;
  bloom: {
    radius: number;
    resolutionScale: number;
    strength: number;
    threshold: number;
    tint: number;
  };
  feedback: { bad: number; good: number; neutral: number };
  fog: { color: number; far: number; near: number };
  hemiLight: { ground: number; intensity: number; sky: number };
  hitLine: {
    core: number;
    coreThickness: number;
    glow: number;
    glowFadePower: number;
    glowOpacity: number;
    glowThickness: number;
  };
  lavaAppearance: LavaAppearance;
  lavaBars: boolean;
  noteBarGeometry: {
    cornerRadiusCap: number;
    cornerRadiusHeightFactor: number;
    cornerRadiusHeightMin: number;
    cornerRadiusWidthFactor: number;
    depth: number;
    laneWidthFactor: number;
  };
  noteSprites: {
    fingerHeightPx: number;
    fingerWidthPx: number;
    labelBottomInsetPx: number;
    labelHeightPx: number;
    labelToFingerGapPx: number;
    labelWidthPx: number;
  };
  particles: { opacity: number; size: number; tint: number };
  pendingColorMode: "gradient" | "staff";
  pendingGradient: { high: number; low: number };
}

const LAVA_STAGE: WaterfallTheme = {
  ambientLight: { color: 0x6a3e3b, intensity: 0.4 },
  background: 0x0c0505,
  backdrop: { deep: 0x140204, mid: 0x3c1208, glow: 0xff5c1a },
  bloom: {
    radius: 0.32,
    resolutionScale: 0.5,
    strength: 0.8,
    threshold: 0.2,
    tint: 0xff8d42,
  },
  feedback: { bad: 0xff5b72, good: 0x54ffb7, neutral: 0xffcb63 },
  fog: { color: 0x130808, far: 4300, near: 430 },
  hemiLight: { ground: 0x241011, intensity: 0.47, sky: 0x8f5f52 },
  hitLine: {
    core: 0xffe8c4,
    coreThickness: 3,
    glow: 0xff7a2f,
    glowFadePower: 6,
    glowOpacity: 0.42,
    glowThickness: 200,
  },
  particles: { opacity: 0.9, size: 12, tint: 0xff8d42 },
  lavaAppearance: {
    handLeftTint: 0xb04a9a,
    handRightTint: 0xffa037,
    handTintMix: 0.52,
    mixBad: 0.9,
    mixGood: 0.88,
    noiseTimeScale: 0.6,
    noiseUvScaleX: 4,
    noiseUvScaleY: 7,
    noiseValueAmp: 0.58,
    noiseValueBase: 0.42,
  },
  noteBarGeometry: {
    cornerRadiusCap: 6,
    cornerRadiusHeightFactor: 0.12,
    cornerRadiusHeightMin: 2,
    cornerRadiusWidthFactor: 0.14,
    depth: 2,
    laneWidthFactor: 0.85,
  },
  noteSprites: {
    fingerHeightPx: 12,
    fingerWidthPx: 12,
    labelBottomInsetPx: 3,
    labelHeightPx: 16,
    labelToFingerGapPx: 3,
    labelWidthPx: 26,
  },
  lavaBars: true,
  pendingColorMode: "gradient",
  pendingGradient: { high: 0xffd67a, low: 0xff5c3a },
};

const AURORA_ICE: WaterfallTheme = {
  ambientLight: { color: 0x4a5568, intensity: 0.38 },
  background: 0x020203,
  backdrop: { deep: 0x051018, mid: 0x143a52, glow: 0x4ecfff },
  bloom: {
    radius: 0.28,
    resolutionScale: 0.5,
    strength: 0.62,
    threshold: 0.28,
    tint: 0x63d8ff,
  },
  feedback: { bad: 0xff4a62, good: 0x40ffb0, neutral: 0x42c8ff },
  fog: { color: 0x010102, far: 4200, near: 450 },
  hemiLight: { ground: 0x18151c, intensity: 0.45, sky: 0x5c6a88 },
  hitLine: {
    core: 0x00e8d0,
    coreThickness: 2.5,
    glow: 0x00a090,
    glowFadePower: 6,
    glowOpacity: 0.34,
    glowThickness: 200,
  },
  particles: { opacity: 0.9, size: 12, tint: 0x63d8ff },
  lavaAppearance: {
    handLeftTint: 0x8c5dff,
    handRightTint: 0x39d4ff,
    handTintMix: 0.56,
    mixBad: 0.9,
    mixGood: 0.88,
    noiseTimeScale: 0.6,
    noiseUvScaleX: 4,
    noiseUvScaleY: 7,
    noiseValueAmp: 0.58,
    noiseValueBase: 0.42,
  },
  noteBarGeometry: {
    cornerRadiusCap: 6,
    cornerRadiusHeightFactor: 0.12,
    cornerRadiusHeightMin: 2,
    cornerRadiusWidthFactor: 0.14,
    depth: 2,
    laneWidthFactor: 0.85,
  },
  noteSprites: {
    fingerHeightPx: 12,
    fingerWidthPx: 12,
    labelBottomInsetPx: 3,
    labelHeightPx: 16,
    labelToFingerGapPx: 3,
    labelWidthPx: 26,
  },
  lavaBars: true,
  pendingColorMode: "staff",
  pendingGradient: { high: 0x5b8bff, low: 0x39d5ff },
};

export const WATERFALL_THEMES: Record<WaterfallThemeId, WaterfallTheme> = {
  [WATERFALL_THEME_IDS.LavaStage]: LAVA_STAGE,
  [WATERFALL_THEME_IDS.AuroraIce]: AURORA_ICE,
};

export const WATERFALL_THEME_LABELS: Record<WaterfallThemeId, string> = {
  [WATERFALL_THEME_IDS.LavaStage]: "Lava stage",
  [WATERFALL_THEME_IDS.AuroraIce]: "Aurora ice",
};

/** @deprecated use `WATERFALL_THEMES["lava-stage"]` */
export const LAVA_STAGE_THEME = LAVA_STAGE;

export type LavaStageTheme = WaterfallTheme;
export type NoteSpritesDims = WaterfallTheme["noteSprites"];

export function getWaterfallTheme(id: WaterfallThemeId): WaterfallTheme {
  return WATERFALL_THEMES[id];
}

export function feedbackColor(
  theme: WaterfallTheme,
  kind: "bad" | "good" | "neutral",
): number {
  if (kind === "good") return theme.feedback.good;
  if (kind === "bad") return theme.feedback.bad;
  return theme.feedback.neutral;
}
