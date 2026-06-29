import type { LaneGeometry } from "../lib/geometry";
import type { NotePlayed, ScoreTimeline, WaterfallThemeId } from "../lib/waterfall/renderer";
import { useWaterfall } from "../lib/waterfall/useWaterfall";
import "./Waterfall.css";

export type WaterfallNote = ScoreTimeline["notes"][number];

type Props = {
  laneGeometry: LaneGeometry;
  score: ScoreTimeline;
  serverElapsedMs: number | null;
  serverPlaying: boolean;
  serverPaused: boolean;
  serverPlaybackSpeed: number;
  latestNotePlayed: NotePlayed | null;
  sessionRestartGeneration: number;
  heldMidiPitches: readonly number[];
  waterfallThemeId: WaterfallThemeId;
};

export function Waterfall(props: Props) {
  let canvasRef: HTMLCanvasElement | undefined;

  useWaterfall({
    canvas: () => canvasRef,
    laneGeometry: () => props.laneGeometry,
    score: () => props.score,
    serverElapsedMs: () => props.serverElapsedMs,
    serverPlaying: () => props.serverPlaying,
    serverPaused: () => props.serverPaused,
    serverPlaybackSpeed: () => props.serverPlaybackSpeed,
    latestNotePlayed: () => props.latestNotePlayed,
    sessionRestartGeneration: () => props.sessionRestartGeneration,
    heldMidiPitches: () => props.heldMidiPitches,
    waterfallThemeId: () => props.waterfallThemeId,
  });

  return <canvas class="waterfall-canvas" ref={canvasRef} />;
}
