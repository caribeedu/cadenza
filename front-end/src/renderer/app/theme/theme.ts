export const THEME_IDS = Object.freeze({
  LavaStage: "lava-stage",
  AuroraIce: "aurora-ice",
} as const);

export type ThemeId = (typeof THEME_IDS)[keyof typeof THEME_IDS];
export type WaterfallTheme = ThemeId;

/** Procedural lava bar appearance (noise domain, brightness, feedback mix). */
export interface LavaAppearance {
  mixBad: number;
  mixGood: number;
  noiseTimeScale: number;
  noiseUvScaleX: number;
  noiseUvScaleY: number;
  noiseValueAmp: number;
  noiseValueBase: number;
}

/** Rounded note mesh: lane-relative width and corner radii (screen px). */
export interface NoteBarGeometry {
  cornerRadiusCap: number;
  cornerRadiusHeightFactor: number;
  cornerRadiusHeightMin: number;
  cornerRadiusWidthFactor: number;
  depth: number;
  laneWidthFactor: number;
}

/** Pitch / finger sprite canvas layout (screen px). */
export interface NoteSpritesDims {
  fingerHeightPx: number;
  fingerWidthPx: number;
  labelBottomInsetPx: number;
  labelHeightPx: number;
  labelToFingerGapPx: number;
  labelWidthPx: number;
}

export interface WaterfallVisualTheme {
  ambientLight: { color: number; intensity: number };
  background: number;
  /**
   * Full-screen mood backdrop: three hex stops (deep / mid / glow) for the
   * ``WaterfallReactiveBackground`` shader only.
   */
  backdrop: { deep: number; glow: number; mid: number };
  bloom: {
    radius: number;
    resolutionScale: number;
    strength: number;
    tint: number;
    threshold: number;
  };
  feedback: {
    bad: number;
    good: number;
    neutral: number;
  };
  fog: { color: number; far: number; near: number };
  hemiLight: { ground: number; intensity: number; sky: number };
  hitLine: {
    core: number;
    coreThickness: number;
    glow: number;
    /** Lower = softer vertical falloff (glow reads taller / wider band). */
    glowFadePower: number;
    glowOpacity: number;
    glowThickness: number;
  };
  /**
   * Strike-line additive point sprites. ``tint`` matches {@link bloom.tint} by
   * default so sparks read coherent with bloom highlights; tune per theme.
   */
  particles: {
    opacity: number;
    size: number;
    tint: number;
  };
  noteBarGeometry: NoteBarGeometry;
  noteSprites: NoteSpritesDims;
  lavaAppearance: LavaAppearance;
  lavaBars: boolean;
  pendingColorMode: "gradient" | "staff";
  pendingGradient: { high: number; low: number };
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  waterfall: WaterfallVisualTheme;
  vars: Readonly<Record<`--${string}`, string>>;
}

const BASE_DIMENSIONS = Object.freeze({
  "--dur-fast": "120ms",
  "--dur-medium": "150ms",
  "--dur-press": "80ms",
  "--easing-standard": "ease",
  "--easing-out": "ease-out",
  "--radius-sm": "5px",
  "--radius-md": "8px",
  "--radius-pill": "999px",
  "--stroke-thin": "0.75",
  "--stroke-base": "1",
  "--space-1": "6px",
  "--space-2": "8px",
  "--space-3": "10px",
  "--space-4": "14px",
  "--font-size-xs": "10px",
  "--font-size-sm": "11px",
  "--font-size-md": "13px",
  "--font-size-lg": "15px",
  "--font-size-xl": "20px",
  "--btn-disabled-opacity": "0.38",
  "--piano-height": "clamp(110px, 15vh, 170px)",
  "--btn-accent-border": "rgba(108, 208, 255, 0.45)",
  "--btn-accent-border-hover": "rgba(108, 208, 255, 0.65)",
  "--btn-accent-shadow": "rgba(108, 208, 255, 0.12)",
} as const);

const UI_AURORA_ICE = Object.freeze({
  "--bg": "#f4f6fb",
  "--panel": "#ffffff",
  "--panel-2": "#eef2fb",
  "--border": "#cfd8eb",
  "--border-strong": "#b4c2df",
  "--fg": "#1f2942",
  "--muted": "#5b6788",
  "--accent": "#f08c2e",
  "--accent-violet": "#7356dd",
  "--good": "#19a55f",
  "--bad": "#d64057",
  "--range-accent": "#63d8ff",
  "--range-track": "#c8d6f3",
  "--range-thumb": "#ffffff",
  "--range-thumb-border": "#7da3d1",
  "--chip-bg": "#eef2fb",
  "--chip-border": "#b4c2df",
  "--chip-fg": "#5b6788",
  "--chip-on-bg": "#19a55f",
  "--chip-on-border": "#19a55f",
  "--chip-on-fg": "#ffffff",
  "--chip-off-bg": "#eef2fb",
  "--chip-off-border": "#b4c2df",
  "--chip-off-fg": "#5b6788",
  "--chip-err-bg": "#d64057",
  "--chip-err-border": "#d64057",
  "--chip-err-fg": "#ffffff",
  "--log-bg": "#ffffff",
  "--key-white-fill": "#ffffff",
  "--key-white-hover": "#edf1fc",
  "--key-black-fill": "#1d2230",
  "--key-black-hover": "#313955",
  "--key-stroke-white": "#a7b5d6",
  "--key-stroke-black": "#0d111b",
  "--key-pressed-good": "var(--good)",
  "--key-pressed-bad": "var(--bad)",
  "--key-pressed-neutral": "var(--accent)",
  "--key-target": "#b8c7e7",
  "--topbar-gradient-start": "#ffffff",
  "--topbar-gradient-end": "#edf2fb",
  "--btn-hover-bg": "#e2eaf9",
  "--btn-accent-bg-start": "#e5ecff",
  "--btn-accent-bg-end": "#d9e2f7",
  "--btn-accent-bg-start-hover": "#d7e1fb",
  "--btn-accent-bg-end-hover": "#c8d6f3",
  "--btn-primary-fg": "#101a2f",
} as const);

const UI_LAVA_STAGE = Object.freeze({
  "--bg": "#050203",
  "--panel": "#1a1418",
  "--panel-2": "#2a1f26",
  "--border": "#503039",
  "--border-strong": "#6a3a45",
  "--fg": "#ffe9db",
  "--muted": "#d1a998",
  "--accent": "#ff9a3c",
  "--accent-violet": "#ff5ec8",
  "--good": "#3df5a1",
  "--bad": "#ff4a62",
  "--range-accent": "#ff9a3c",
  "--range-track": "#503039",
  "--range-thumb": "#ffd8be",
  "--range-thumb-border": "#8f4e5e",
  "--chip-bg": "#2a1f26",
  "--chip-border": "#6a3a45",
  "--chip-fg": "#d1a998",
  "--chip-on-bg": "#3df5a1",
  "--chip-on-border": "#3df5a1",
  "--chip-on-fg": "#13271f",
  "--chip-off-bg": "#2a1f26",
  "--chip-off-border": "#6a3a45",
  "--chip-off-fg": "#d1a998",
  "--chip-err-bg": "#ff4a62",
  "--chip-err-border": "#ff4a62",
  "--chip-err-fg": "#ffffff",
  "--log-bg": "#1a1418",
  "--key-white-fill": "#ffe9db",
  "--key-white-hover": "#ffd8be",
  "--key-black-fill": "#1f0f13",
  "--key-black-hover": "#3a1721",
  "--key-stroke-white": "#5f2f3b",
  "--key-stroke-black": "#060103",
  "--key-pressed-good": "var(--good)",
  "--key-pressed-bad": "var(--bad)",
  "--key-pressed-neutral": "var(--accent)",
  "--key-target": "#5f2738",
  "--topbar-gradient-start": "#1a1418",
  "--topbar-gradient-end": "#100d10",
  "--btn-hover-bg": "#3a232d",
  "--btn-accent-bg-start": "#4f2730",
  "--btn-accent-bg-end": "#351921",
  "--btn-accent-bg-start-hover": "#63313b",
  "--btn-accent-bg-end-hover": "#431f29",
  "--btn-primary-fg": "#2a1200",
} as const);

const WATERFALL_AURORA_ICE: WaterfallVisualTheme = Object.freeze({
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
});

const WATERFALL_LAVA_STAGE: WaterfallVisualTheme = Object.freeze({
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
});

function makeTheme(
  id: ThemeId,
  label: string,
  waterfall: WaterfallVisualTheme,
  colors: Record<`--${string}`, string>,
): ThemeDefinition {
  return {
    id,
    label,
    waterfall,
    vars: Object.freeze({
      ...BASE_DIMENSIONS,
      ...colors,
    }),
  };
}

export const THEMES: Readonly<Record<ThemeId, ThemeDefinition>> =
  Object.freeze({
    [THEME_IDS.LavaStage]: makeTheme(
      THEME_IDS.LavaStage,
      "Lava Stage",
      WATERFALL_LAVA_STAGE,
      UI_LAVA_STAGE,
    ),
    [THEME_IDS.AuroraIce]: makeTheme(
      THEME_IDS.AuroraIce,
      "Aurora Ice",
      WATERFALL_AURORA_ICE,
      UI_AURORA_ICE,
    ),
  });

export const THEME_LIST = Object.freeze(
  Object.values(THEMES) as readonly ThemeDefinition[],
);

export const DEFAULT_THEME: ThemeId = THEME_IDS.LavaStage;

export function applyThemeVars(
  root: HTMLElement,
  themeId: ThemeId,
): void {
  const theme = THEMES[themeId];
  root.dataset.theme = themeId;
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }
}

export function bootTheme(theme: ThemeId = DEFAULT_THEME): void {
  if (typeof document === "undefined") return;
  applyThemeVars(document.documentElement, theme);
}
