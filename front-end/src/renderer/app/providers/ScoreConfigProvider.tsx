import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import {
  type ColourPalette,
  DEFAULT_COLOUR_PALETTE,
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_TOLERANCE_MS,
  DEFAULT_VISUALIZATION_MODE,
  PLAYBACK_SPEED_MAX,
  PLAYBACK_SPEED_MIN,
  PLAYBACK_SPEED_STEP,
  TOLERANCE_MAX_MS,
  TOLERANCE_MIN_MS,
  TOLERANCE_STEP_MS,
  type VisualizationMode,
} from "../constants";

export interface NumericBounds {
  max: number;
  min: number;
  step: number;
}

export type ToleranceBounds = NumericBounds;
export type PlaybackSpeedBounds = NumericBounds;

export interface ScoreConfigContextValue {
  palette: ColourPalette;
  playbackSpeed: number;
  playbackSpeedBounds: PlaybackSpeedBounds;
  setPalette: (palette: ColourPalette) => void;
  setPlaybackSpeed: (value: number) => void;
  setToleranceMs: (value: number) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  toleranceBounds: ToleranceBounds;
  toleranceMs: number;
  visualizationMode: VisualizationMode;
}

const ScoreConfigContext = createContext<null | ScoreConfigContextValue>(null);

// Holds user-tunable visualisation/scoring knobs that live purely on
// the client: tolerance slider, colour palette, visualisation mode. 
// Tolerance is *also* mirrored by the server, but this provider 
// keeps the UI's authoritative value in one place so controls don't
// need to reach into the playback provider or the raw WebSocket each render.
export function ScoreConfigProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [toleranceMs, setToleranceMsState] = useState(DEFAULT_TOLERANCE_MS);
  const [playbackSpeed, setPlaybackSpeedState] = useState(
    DEFAULT_PLAYBACK_SPEED,
  );
  const [palette, setPalette] = useState<ColourPalette>(DEFAULT_COLOUR_PALETTE);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>(
    DEFAULT_VISUALIZATION_MODE,
  );

  const setToleranceMs = useCallback((value: number) => {
    const clamped = Math.max(
      TOLERANCE_MIN_MS,
      Math.min(TOLERANCE_MAX_MS, Number(value)),
    );
    setToleranceMsState(clamped);
  }, []);

  const setPlaybackSpeed = useCallback((value: number) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return;
    const clamped = Math.max(
      PLAYBACK_SPEED_MIN,
      Math.min(PLAYBACK_SPEED_MAX, numeric),
    );
    setPlaybackSpeedState(clamped);
  }, []);

  const value = useMemo<ScoreConfigContextValue>(
    () => ({
      palette,
      playbackSpeed,
      playbackSpeedBounds: {
        max: PLAYBACK_SPEED_MAX,
        min: PLAYBACK_SPEED_MIN,
        step: PLAYBACK_SPEED_STEP,
      },
      setPalette,
      setPlaybackSpeed,
      setToleranceMs,
      setVisualizationMode,
      toleranceBounds: {
        max: TOLERANCE_MAX_MS,
        min: TOLERANCE_MIN_MS,
        step: TOLERANCE_STEP_MS,
      },
      toleranceMs,
      visualizationMode,
    }),
    [
      toleranceMs,
      setToleranceMs,
      playbackSpeed,
      setPlaybackSpeed,
      palette,
      visualizationMode,
    ],
  );

  return (
    <ScoreConfigContext.Provider value={value}>
      {children}
    </ScoreConfigContext.Provider>
  );
}

export function useScoreConfig(): ScoreConfigContextValue {
  const ctx = useContext(ScoreConfigContext);
  if (!ctx)
    throw new Error("useScoreConfig must be used inside <ScoreConfigProvider>");
  return ctx;
}
