import type { LaneGeometry } from "@shared/types/geometry";
import type { NotePlayed, ScoreTimeline } from "@shared/types/score";

import { WaterfallRenderer } from "@shared/lib/waterfall-renderer";
import { type RefObject, useEffect, useRef } from "react";

export interface UseWaterfallOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  laneGeometry: LaneGeometry | null;
  latestNotePlayed: NotePlayed | null;
  score: null | ScoreTimeline;
  serverPaused: boolean;
  serverPlaying: boolean;
}

// Imperative bridge between React and the Three.js renderer. The
// renderer keeps the same class-based API as before (start/pause/
// resume/stop/setScore/reportPlayback/setLaneGeometry) and this hook
// just owns its lifecycle plus a small effect-per-prop that translates
// React state changes into the right method calls.
export function useWaterfall({
  canvasRef,
  laneGeometry,
  latestNotePlayed,
  score,
  serverPaused,
  serverPlaying,
}: UseWaterfallOptions): RefObject<null | WaterfallRenderer> {
  const rendererRef = useRef<null | WaterfallRenderer>(null);
  const previousPlayingRef = useRef(false);
  const previousPausedRef = useRef(false);
  const previousNoteRef = useRef<NotePlayed | null>(null);

  // Mount once per canvas. The renderer self-observes canvas size, so
  // resizes don't need to tear it down.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !laneGeometry) return undefined;

    const renderer = new WaterfallRenderer(canvas, laneGeometry);
    rendererRef.current = renderer;
    return () => {
      renderer.destroy();
      rendererRef.current = null;
    };
    // Intentionally ignore laneGeometry identity: swaps are handled by
    // the dedicated effect below so we avoid tearing down WebGL state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !laneGeometry) return;
    renderer.setLaneGeometry(laneGeometry);
  }, [laneGeometry]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !score) return;
    renderer.setScore(score);
  }, [score]);

  // Drive start / pause / resume from the *server's* authoritative
  // state rather than a local React flag so two UIs connected to the
  // same backend stay synchronised.
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    const wasPlaying = previousPlayingRef.current;
    const wasPaused = previousPausedRef.current;

    if (serverPlaying && !wasPlaying && !serverPaused) {
      renderer.start();
    } else if (serverPaused && !wasPaused) {
      renderer.pause();
    } else if (!serverPaused && wasPaused) {
      renderer.resume();
    } else if (!serverPlaying && !serverPaused && (wasPlaying || wasPaused)) {
      renderer.stop();
    }

    previousPlayingRef.current = serverPlaying;
    previousPausedRef.current = serverPaused;
  }, [serverPlaying, serverPaused]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer || !latestNotePlayed) return;
    if (previousNoteRef.current === latestNotePlayed) return;
    previousNoteRef.current = latestNotePlayed;
    renderer.reportPlayback(latestNotePlayed);
  }, [latestNotePlayed]);

  return rendererRef;
}
