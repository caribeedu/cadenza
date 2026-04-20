export const DEFAULT_BACKEND_URL = "ws://127.0.0.1:8765";

export const DEFAULT_TOLERANCE_MS = 100;
export const TOLERANCE_MIN_MS = 20;
export const TOLERANCE_MAX_MS = 300;
export const TOLERANCE_STEP_MS = 5;

// Visualisation modes surface a dropdown today, but the enum lives here
// so future feature work (staff / piano-roll / spectrogram views) can
// add entries without touching the player feature.
export const VISUALIZATION_MODES = Object.freeze({
  Waterfall: "waterfall",
} as const);

export type VisualizationMode =
  (typeof VISUALIZATION_MODES)[keyof typeof VISUALIZATION_MODES];

export const DEFAULT_VISUALIZATION_MODE: VisualizationMode =
  VISUALIZATION_MODES.Waterfall;

// Default colour palette. Lives in ScoreConfigProvider state so the
// future "colour settings" page can mutate it without component
// edits; the waterfall reads palette values through the provider.
export const DEFAULT_COLOUR_PALETTE = Object.freeze({
  bad: "#ff5a6c",
  good: "#3fd97f",
  neutral: "#6cd0ff",
  pendingBlack: "#a77bff",
  pendingWhite: "#6cd0ff",
});

export type ColourPalette = typeof DEFAULT_COLOUR_PALETTE;
