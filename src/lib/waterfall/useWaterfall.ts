import { createEffect, onCleanup } from "solid-js";
import type { LaneGeometry } from "../geometry";
import { WaterfallRenderer, type NotePlayed, type ScoreTimeline, type WaterfallThemeId } from "./renderer";

const EMPTY_SCORE: ScoreTimeline = { bpm: 120, duration_ms: 0, notes: [] };
const ELAPSED_REALIGN_EPSILON_MS = 8;

export type UseWaterfallOptions = {
  canvas: () => HTMLCanvasElement | undefined;
  laneGeometry: () => LaneGeometry | null;
  score: () => ScoreTimeline | null;
  serverElapsedMs: () => number | null;
  serverPlaying: () => boolean;
  serverPaused: () => boolean;
  serverPlaybackSpeed: () => number;
  latestNotePlayed: () => NotePlayed | null;
  sessionRestartGeneration: () => number;
  heldMidiPitches: () => readonly number[];
  waterfallThemeId: () => WaterfallThemeId;
};

export function useWaterfall(options: UseWaterfallOptions) {
  let renderer: WaterfallRenderer | null = null;
  let prevAppliedSpeed: number | null = null;
  let previousPlaying = false;
  let previousPaused = false;
  let previousNote: NotePlayed | null = null;
  let lastPausedAlignMs: number | null = null;
  let serverSpeed = options.serverPlaybackSpeed();

  createEffect(() => {
    serverSpeed = options.serverPlaybackSpeed();
  });

  createEffect(() => {
    const canvas = options.canvas();
    const laneGeometry = options.laneGeometry();
    if (!canvas || !laneGeometry) return;

    const themeId = options.waterfallThemeId();
    const instance = new WaterfallRenderer(canvas, laneGeometry, serverSpeed, undefined, themeId);
    renderer = instance;

    onCleanup(() => {
      instance.destroy();
      renderer = null;
      prevAppliedSpeed = null;
      previousPlaying = false;
      previousPaused = false;
      lastPausedAlignMs = null;
    });
  });

  createEffect(() => {
    if (!renderer) return;
    const speed = options.serverPlaybackSpeed();
    if (prevAppliedSpeed === speed) return;
    prevAppliedSpeed = speed;
    renderer.setPlaybackSpeed(speed, options.serverElapsedMs() ?? undefined);
  });

  createEffect(() => {
    if (!renderer) return;
    const laneGeometry = options.laneGeometry();
    if (!laneGeometry) return;
    renderer.setLaneGeometry(laneGeometry);
  });

  createEffect(() => {
    if (!renderer) return;
    renderer.setScore(options.score() ?? EMPTY_SCORE);
  });

  createEffect(() => {
    if (!renderer) return;

    const serverPlaying = options.serverPlaying();
    const serverPaused = options.serverPaused();
    const serverElapsedMs = options.serverElapsedMs();
    const wasPlaying = previousPlaying;
    const wasPaused = previousPaused;

    if (!serverPaused && wasPaused) {
      renderer.resume();
    } else if (serverPlaying && !wasPlaying && !serverPaused) {
      if (typeof serverElapsedMs === "number") renderer.startAt(serverElapsedMs);
      else renderer.start();
    } else if (serverPaused && !wasPaused) {
      if (typeof serverElapsedMs === "number") renderer.pauseAt(serverElapsedMs);
    } else if (!serverPlaying && !serverPaused && (wasPlaying || wasPaused)) {
      renderer.stop();
    }

    previousPlaying = serverPlaying;
    previousPaused = serverPaused;
  });

  createEffect(() => {
    if (!renderer) return;
    if (!options.serverPaused()) {
      lastPausedAlignMs = null;
      return;
    }
    const serverElapsedMs = options.serverElapsedMs();
    if (typeof serverElapsedMs !== "number") return;
    if (
      lastPausedAlignMs != null &&
      Math.abs(serverElapsedMs - lastPausedAlignMs) < ELAPSED_REALIGN_EPSILON_MS
    ) {
      return;
    }
    renderer.pauseAt(serverElapsedMs);
    lastPausedAlignMs = serverElapsedMs;
  });

  createEffect(() => {
    if (!renderer) return;
    if (options.sessionRestartGeneration() === 0) return;
    renderer.startAt(0);
  });

  createEffect(() => {
    if (!renderer) return;
    const note = options.latestNotePlayed();
    if (!note) return;
    if (previousNote === note) return;
    previousNote = note;
    renderer.reportPlayback(note);
  });

  createEffect(() => {
    if (!renderer) return;
    renderer.setHeldPitches(options.heldMidiPitches());
  });

  createEffect(() => {
    if (!renderer) return;
    renderer.setTheme(options.waterfallThemeId());
  });
}
