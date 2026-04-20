import { usePlayback } from "@app/providers/PlaybackProvider";
import { useScoreConfig } from "@app/providers/ScoreConfigProvider";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  useCallback,
} from "react";

export function ToleranceSlider(): ReactElement {
  const { setToleranceMs, toleranceBounds, toleranceMs } = useScoreConfig();
  const { commitTolerance } = usePlayback();

  const onInput = useCallback(
    (event: FormEvent<HTMLInputElement>) =>
      setToleranceMs(Number((event.target as HTMLInputElement).value)),
    [setToleranceMs],
  );

  // Commit on `change` (fires once per drag commit in Chromium+Firefox)
  // so the WebSocket sees one frame per gesture rather than dozens.
  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      commitTolerance(Number(event.target.value)),
    [commitTolerance],
  );

  return (
    <label className="field tolerance">
      <span>Tolerance</span>
      <div className="tolerance-row">
        <input
          aria-label="Hit-timing tolerance in milliseconds"
          max={toleranceBounds.max}
          min={toleranceBounds.min}
          onChange={onChange}
          onInput={onInput}
          step={toleranceBounds.step}
          type="range"
          value={toleranceMs}
        />
        <span className="tolerance-value">{Math.round(toleranceMs)} ms</span>
      </div>
    </label>
  );
}
