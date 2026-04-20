import { usePlayback } from "@app/providers/PlaybackProvider";
import { useScoreConfig } from "@app/providers/ScoreConfigProvider";
import {
  type ChangeEvent,
  type FormEvent,
  type ReactElement,
  useCallback,
} from "react";

// Replay-speed slider — mirrors ``ToleranceSlider`` so the WebSocket
// sees one ``set_playback_speed`` frame per drag commit rather than
// dozens of in-flight values. Local (drag-in-progress) updates go
// through the ScoreConfigProvider; the commit on ``change`` is what
// the server (and every other connected UI) actually hears.
export function PlaybackSpeedSlider(): ReactElement {
  const { playbackSpeed, playbackSpeedBounds, setPlaybackSpeed } =
    useScoreConfig();
  const { commitPlaybackSpeed } = usePlayback();

  const onInput = useCallback(
    (event: FormEvent<HTMLInputElement>) =>
      setPlaybackSpeed(Number((event.target as HTMLInputElement).value)),
    [setPlaybackSpeed],
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      commitPlaybackSpeed(Number(event.target.value)),
    [commitPlaybackSpeed],
  );

  return (
    <label className="field playback-speed">
      <span>Speed</span>
      <div className="playback-speed-row">
        <input
          aria-label="Replay speed multiplier"
          max={playbackSpeedBounds.max}
          min={playbackSpeedBounds.min}
          onChange={onChange}
          onInput={onInput}
          step={playbackSpeedBounds.step}
          type="range"
          value={playbackSpeed}
        />
        <span className="playback-speed-value">
          {playbackSpeed.toFixed(2)}×
        </span>
      </div>
    </label>
  );
}
