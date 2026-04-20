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
  DEFAULT_TOLERANCE_MS,
  DEFAULT_VISUALIZATION_MODE,
  TOLERANCE_MAX_MS,
  TOLERANCE_MIN_MS,
  TOLERANCE_STEP_MS,
  type VisualizationMode,
} from "../constants";

export interface ToleranceBounds {
  max: number;
  min: number;
  step: number;
}

export interface ScoreConfigContextValue {
  palette: ColourPalette;
  setPalette: (palette: ColourPalette) => void;
  setToleranceMs: (value: number) => void;
  setVisualizationMode: (mode: VisualizationMode) => void;
  toleranceBounds: ToleranceBounds;
  toleranceMs: number;
  visualizationMode: VisualizationMode;
}

const ScoreConfigContext = createContext<null | ScoreConfigContextValue>(null);

// Holds user-tunable visualisation/scoring knobs that live purely on
// the client: tolerance slider, colour palette, visualisation mode
// (and, in the future, velocity curves). Tolerance is *also* mirrored
// by the server, but this provider keeps the UI's authoritative value
// in one place so controls don't need to reach into the playback
// provider or the raw WebSocket each render.
export function ScoreConfigProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const [toleranceMs, setToleranceMsState] = useState(DEFAULT_TOLERANCE_MS);
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

  const value = useMemo<ScoreConfigContextValue>(
    () => ({
      palette,
      setPalette,
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
    [toleranceMs, setToleranceMs, palette, visualizationMode],
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
