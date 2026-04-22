export const UI_THEME_IDS = Object.freeze({
  CadenzaDark: "cadenza-dark",
  CadenzaLight: "cadenza-light",
  LavaStage: "lava-stage",
  AuroraIce: "aurora-ice",
  SunsetPaper: "sunset-paper",
} as const);

export type UiThemeId = (typeof UI_THEME_IDS)[keyof typeof UI_THEME_IDS];
export type WaterfallTheme = UiThemeId;

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

export interface UiThemeDefinition {
  id: UiThemeId;
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

const DARK_COLORS = Object.freeze({
  "--bg": "#020203",
  "--panel": "#151826",
  "--panel-2": "#1f2336",
  "--border": "#272b40",
  "--border-strong": "#2e3350",
  "--fg": "#e8ecf7",
  "--muted": "#8892b0",
  "--accent": "#ffb84d",
  "--accent-violet": "#a77bff",
  "--good": "#3fd97f",
  "--bad": "#ff5a6c",
  "--log-bg": "#151826",
  "--key-white-fill": "#eceef5",
  "--key-white-hover": "#d7dbe8",
  "--key-black-fill": "#14161f",
  "--key-black-hover": "#262a3c",
  "--key-stroke-white": "#1a1c2c",
  "--key-stroke-black": "#000000",
  "--key-pressed-good": "var(--good)",
  "--key-pressed-bad": "var(--bad)",
  "--key-pressed-neutral": "var(--accent)",
  "--key-target": "#2f3656",
  "--topbar-gradient-start": "var(--panel)",
  "--topbar-gradient-end": "#121521",
  "--btn-hover-bg": "#262b42",
  "--btn-accent-bg-start": "#2a3148",
  "--btn-accent-bg-end": "#1e2338",
  "--btn-accent-bg-start-hover": "#323a55",
  "--btn-accent-bg-end-hover": "#252b44",
  "--btn-primary-fg": "#08131c",
} as const);

const LIGHT_COLORS = Object.freeze({
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

const LAVA_STAGE_COLORS = Object.freeze({
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

const AURORA_ICE_COLORS = Object.freeze({
  "--bg": "#041018",
  "--panel": "#0f2030",
  "--panel-2": "#163449",
  "--border": "#255069",
  "--border-strong": "#327396",
  "--fg": "#dbf9ff",
  "--muted": "#95c6d8",
  "--accent": "#63d8ff",
  "--accent-violet": "#95a2ff",
  "--good": "#5cf5c8",
  "--bad": "#ff6282",
  "--log-bg": "#0f2030",
  "--key-white-fill": "#dbf9ff",
  "--key-white-hover": "#c2f1ff",
  "--key-black-fill": "#102332",
  "--key-black-hover": "#1a384d",
  "--key-stroke-white": "#2f6079",
  "--key-stroke-black": "#06131d",
  "--key-pressed-good": "var(--good)",
  "--key-pressed-bad": "var(--bad)",
  "--key-pressed-neutral": "var(--accent)",
  "--key-target": "#2e5f82",
  "--topbar-gradient-start": "#0f2030",
  "--topbar-gradient-end": "#0b1a27",
  "--btn-hover-bg": "#21445d",
  "--btn-accent-bg-start": "#1f4d65",
  "--btn-accent-bg-end": "#163447",
  "--btn-accent-bg-start-hover": "#29617f",
  "--btn-accent-bg-end-hover": "#1c445d",
  "--btn-primary-fg": "#00141f",
} as const);

const SUNSET_PAPER_COLORS = Object.freeze({
  "--bg": "#fff7ec",
  "--panel": "#fffdf8",
  "--panel-2": "#fbe9d2",
  "--border": "#e4c9aa",
  "--border-strong": "#d6b289",
  "--fg": "#4a2f1c",
  "--muted": "#896249",
  "--accent": "#e9823a",
  "--accent-violet": "#9f62c9",
  "--good": "#2ea067",
  "--bad": "#cf4d5f",
  "--log-bg": "#fffdf8",
  "--key-white-fill": "#ffffff",
  "--key-white-hover": "#f9ebdc",
  "--key-black-fill": "#442e22",
  "--key-black-hover": "#62402f",
  "--key-stroke-white": "#cda984",
  "--key-stroke-black": "#2f1e15",
  "--key-pressed-good": "var(--good)",
  "--key-pressed-bad": "var(--bad)",
  "--key-pressed-neutral": "var(--accent)",
  "--key-target": "#ebc69d",
  "--topbar-gradient-start": "#fffdf8",
  "--topbar-gradient-end": "#f8ecd9",
  "--btn-hover-bg": "#f3dec4",
  "--btn-accent-bg-start": "#f1d8bb",
  "--btn-accent-bg-end": "#e5c8a6",
  "--btn-accent-bg-start-hover": "#eccda9",
  "--btn-accent-bg-end-hover": "#dcba92",
  "--btn-primary-fg": "#2f1808",
} as const);

const WATERFALL_CADENZA_DARK: WaterfallVisualTheme = Object.freeze({
  ambientLight: { color: 0x4a5568, intensity: 0.38 },
  background: 0x020203,
  bloom: {
    radius: 0.3,
    resolutionScale: 0.5,
    strength: 0.72,
    threshold: 0.24,
    tint: 0xff9f52,
  },
  feedback: { bad: 0xff4a62, good: 0x40ffb0, neutral: 0xffb84d },
  fog: { color: 0x010102, far: 4200, near: 450 },
  hemiLight: { ground: 0x18151c, intensity: 0.45, sky: 0x5c6a88 },
  hitLine: {
    core: 0xfff2e6,
    coreThickness: 3,
    glow: 0xff5500,
    glowFadePower: 6,
    glowOpacity: 0.4,
    glowThickness: 200,
  },
  particles: { opacity: 0.9, size: 12, tint: 0xff9f52 },
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
  pendingGradient: { high: 0xffcc4d, low: 0xff1e12 },
});

const WATERFALL_CADENZA_LIGHT: WaterfallVisualTheme = Object.freeze({
  ambientLight: { color: 0x4a5568, intensity: 0.38 },
  background: 0x020203,
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
  lavaBars: false,
  pendingColorMode: "staff",
  pendingGradient: { high: 0x5b8bff, low: 0x39d5ff },
});

const WATERFALL_LAVA_STAGE: WaterfallVisualTheme = Object.freeze({
  ambientLight: { color: 0x6a3e3b, intensity: 0.4 },
  background: 0x0c0505,
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

const WATERFALL_AURORA_ICE: WaterfallVisualTheme = Object.freeze({
  ambientLight: { color: 0x365a6f, intensity: 0.42 },
  background: 0x02060b,
  bloom: {
    radius: 0.3,
    resolutionScale: 0.55,
    strength: 0.66,
    threshold: 0.3,
    tint: 0x63d8ff,
  },
  feedback: { bad: 0xff5f7f, good: 0x60ffd6, neutral: 0x63b4ff },
  fog: { color: 0x01070a, far: 4600, near: 380 },
  hemiLight: { ground: 0x0f1a1d, intensity: 0.5, sky: 0x3f7d94 },
  hitLine: {
    core: 0x72fff0,
    coreThickness: 2.5,
    glow: 0x1c9aa0,
    glowFadePower: 6,
    glowOpacity: 0.36,
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
  lavaBars: false,
  pendingColorMode: "gradient",
  pendingGradient: { high: 0x6d88ff, low: 0x34f5d5 },
});

const WATERFALL_SUNSET_PAPER: WaterfallVisualTheme = Object.freeze({
  ambientLight: { color: 0x6a3e3b, intensity: 0.4 },
  background: 0x0c0505,
  bloom: {
    radius: 0.3,
    resolutionScale: 0.5,
    strength: 0.7,
    threshold: 0.24,
    tint: 0xe9823a,
  },
  feedback: { bad: 0xff5b72, good: 0x54ffb7, neutral: 0xffcb63 },
  fog: { color: 0x130808, far: 4300, near: 430 },
  hemiLight: { ground: 0x241011, intensity: 0.47, sky: 0x8f5f52 },
  hitLine: {
    core: 0xffe8c4,
    coreThickness: 3,
    glow: 0xff7a2f,
    glowFadePower: 6,
    glowOpacity: 0.4,
    glowThickness: 200,
  },
  particles: { opacity: 0.9, size: 12, tint: 0xe9823a },
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
  id: UiThemeId,
  label: string,
  waterfall: WaterfallVisualTheme,
  colors: Record<`--${string}`, string>,
): UiThemeDefinition {
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

export const UI_THEMES: Readonly<Record<UiThemeId, UiThemeDefinition>> =
  Object.freeze({
    [UI_THEME_IDS.CadenzaDark]: makeTheme(
      UI_THEME_IDS.CadenzaDark,
      "Cadenza Dark",
      WATERFALL_CADENZA_DARK,
      DARK_COLORS,
    ),
    [UI_THEME_IDS.CadenzaLight]: makeTheme(
      UI_THEME_IDS.CadenzaLight,
      "Cadenza Light",
      WATERFALL_CADENZA_LIGHT,
      LIGHT_COLORS,
    ),
    [UI_THEME_IDS.LavaStage]: makeTheme(
      UI_THEME_IDS.LavaStage,
      "Lava Stage",
      WATERFALL_LAVA_STAGE,
      LAVA_STAGE_COLORS,
    ),
    [UI_THEME_IDS.AuroraIce]: makeTheme(
      UI_THEME_IDS.AuroraIce,
      "Aurora Ice",
      WATERFALL_AURORA_ICE,
      AURORA_ICE_COLORS,
    ),
    [UI_THEME_IDS.SunsetPaper]: makeTheme(
      UI_THEME_IDS.SunsetPaper,
      "Sunset Paper",
      WATERFALL_SUNSET_PAPER,
      SUNSET_PAPER_COLORS,
    ),
  });

export const UI_THEME_LIST = Object.freeze(
  Object.values(UI_THEMES) as readonly UiThemeDefinition[],
);

export const DEFAULT_UI_THEME: UiThemeId = UI_THEME_IDS.CadenzaDark;

export function applyThemeVars(
  root: HTMLElement,
  themeId: UiThemeId,
): void {
  const theme = UI_THEMES[themeId];
  root.dataset.theme = themeId;
  for (const [name, value] of Object.entries(theme.vars)) {
    root.style.setProperty(name, value);
  }
}

export function bootTheme(theme: UiThemeId = DEFAULT_UI_THEME): void {
  if (typeof document === "undefined") return;
  applyThemeVars(document.documentElement, theme);
}
