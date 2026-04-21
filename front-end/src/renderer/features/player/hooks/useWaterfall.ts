import type { LaneGeometry } from "@shared/types/geometry";
import type { NotePlayed, ScoreTimeline } from "@shared/types/score";

import { WaterfallRenderer } from "@shared/lib/waterfall";

/** Clears meshes when ``score`` is ``null`` (e.g. WebSocket disconnect). */
const EMPTY_SCORE_TIMELINE: ScoreTimeline = {
  bpm: 120,
  duration_ms: 0,
  notes: [],
};
import {
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseWaterfallOptions {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  laneGeometry: LaneGeometry | null;
  latestNotePlayed: NotePlayed | null;
  score: null | ScoreTimeline;
  // Server-authoritative playhead in virtual milliseconds. ``null``
  // means the hub has not yet reported an active session; the renderer
  // uses its own local clock when no server value is available.
  serverElapsedMs: null | number;
  serverPaused: boolean;
  serverPlaybackSpeed: number;
  serverPlaying: boolean;
  /** Bumps on every Start/Restart so we reset the waterfall when the
   *  server clock resets but ``serverPlaying`` never flips to false. */
  sessionRestartGeneration: number;
}

// Imperative bridge between React and the Three.js renderer.
//
// Key architectural choice: the renderer's virtual-time clock is
// **driven by server-echoed state**, not by the UI slider. The slider
// still updates its own React state for label responsiveness, but the
// renderer only changes its speed and realigns its virtual time when
// the backend confirms via a ``status`` frame. This is the only way
// to keep the two sides from drifting apart when the user drags the
// slider (which used to rebase the renderer optimistically on every
// pixel tick while the backend stayed at the old speed until commit)
// or when a client reloads mid-session (where a naive ``start()`` at
// ``performance.now()`` would zero the renderer's clock against a
// backend clock that has been running for minutes).
//
// The renderer instance is stored in React *state* (not just a ref)
// because its construction is gated on the asynchronous arrival of
// ``laneGeometry`` — we need a re-render when the renderer becomes
// available so downstream effects fire and apply any data that
// arrived before the first layout tick.
export function useWaterfall({
  canvasRef,
  laneGeometry,
  latestNotePlayed,
  score,
  serverElapsedMs,
  serverPaused,
  serverPlaybackSpeed,
  serverPlaying,
  sessionRestartGeneration,
}: UseWaterfallOptions): RefObject<null | WaterfallRenderer> {
  const [renderer, setRenderer] = useState<null | WaterfallRenderer>(null);
  const rendererRef = useRef<null | WaterfallRenderer>(null);
  const previousPlayingRef = useRef(false);
  const previousPausedRef = useRef(false);
  const previousNoteRef = useRef<NotePlayed | null>(null);
  // Last server speed we actually pushed into the renderer. Tracked
  // separately from ``serverPlaybackSpeed`` so the sync effect is a
  // no-op on status frames that only carry an ``elapsed_ms`` update
  // (otherwise every server broadcast would snap the playhead and
  // produce visible jitter equal to the network RTT).
  const prevAppliedSpeedRef = useRef<null | number>(null);
  // Snapshot of the speed to seed a freshly-created renderer. Keeps
  // the construction effect free of a ``serverPlaybackSpeed``
  // dependency that would tear down the WebGL context on every slider
  // tick.
  const serverSpeedRef = useRef(serverPlaybackSpeed);
  useEffect(() => {
    serverSpeedRef.current = serverPlaybackSpeed;
  }, [serverPlaybackSpeed]);

  // Create the renderer once ``canvas`` AND ``laneGeometry`` are both
  // available. ``laneGeometry != null`` is used as the boolean gate
  // (not the geometry identity) so that subsequent piano reflows —
  // which mutate ``laneGeometry``'s identity — don't tear down and
  // rebuild the WebGL context. Those reflows are applied by the
  // dedicated ``setLaneGeometry`` effect below.
  const hasLaneGeometry = laneGeometry != null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !laneGeometry) return undefined;

    const instance = new WaterfallRenderer(canvas, laneGeometry, {
      playbackSpeed: serverSpeedRef.current,
    });
    rendererRef.current = instance;
    setRenderer(instance);
    return () => {
      instance.destroy();
      rendererRef.current = null;
      setRenderer(null);
      // A new renderer starts at its constructor speed, so force the
      // sync effect below to reapply the server speed on next mount.
      prevAppliedSpeedRef.current = null;
      previousPlayingRef.current = false;
      previousPausedRef.current = false;
    };
    // We intentionally ignore ``laneGeometry`` identity changes here —
    // reflows are handled by ``setLaneGeometry`` below; rebuilding the
    // WebGL context on every ResizeObserver tick would cause flicker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, hasLaneGeometry]);

  // Mirror the server-confirmed speed into the renderer, aligning the
  // virtual-time playhead to ``serverElapsedMs`` whenever available.
  // The guard on ``prevAppliedSpeedRef`` ensures we only snap on an
  // actual speed transition, not on every status frame.
  useEffect(() => {
    if (!renderer) return;
    if (prevAppliedSpeedRef.current === serverPlaybackSpeed) return;
    prevAppliedSpeedRef.current = serverPlaybackSpeed;
    renderer.setPlaybackSpeed(
      serverPlaybackSpeed,
      serverElapsedMs ?? undefined,
    );
  }, [renderer, serverPlaybackSpeed, serverElapsedMs]);

  useEffect(() => {
    if (!renderer || !laneGeometry) return;
    renderer.setLaneGeometry(laneGeometry);
  }, [renderer, laneGeometry]);

  useEffect(() => {
    if (!renderer) return;
    renderer.setScore(score ?? EMPTY_SCORE_TIMELINE);
  }, [renderer, score]);

  // Drive start / pause / resume / stop from server-authoritative
  // state, aligning the local virtual-time clock to the server's
  // ``elapsed_ms`` on every transition so a reload or speed-change
  // commit can never leave the renderer ahead or behind the hub.
  useEffect(() => {
    if (!renderer) return;

    const wasPlaying = previousPlayingRef.current;
    const wasPaused = previousPausedRef.current;

    // Resume is checked **before** start because the pause→play
    // transition (``wasPaused=true``, ``serverPlaying=true``,
    // ``serverPaused=false``) also satisfies the first-start predicate
    // ``serverPlaying && !wasPlaying && !serverPaused``. Letting the
    // start branch win would call ``startAt(elapsed_ms)`` — which
    // *also* resets every note to ``pending`` and rebases the clock
    // as if the session were beginning, instead of honouring the
    // position frozen by the previous pause.
    if (!serverPaused && wasPaused) {
      renderer.resume();
    } else if (serverPlaying && !wasPlaying && !serverPaused) {
      if (typeof serverElapsedMs === "number") renderer.startAt(serverElapsedMs);
      else renderer.start();
    } else if (serverPaused && !wasPaused) {
      if (typeof serverElapsedMs === "number") renderer.pauseAt(serverElapsedMs);
      else renderer.pause();
    } else if (!serverPlaying && !serverPaused && (wasPlaying || wasPaused)) {
      renderer.stop();
    }

    previousPlayingRef.current = serverPlaying;
    previousPausedRef.current = serverPaused;
    // ``serverElapsedMs`` is read but intentionally excluded from deps:
    // it changes on every status frame, but we only realign on actual
    // play/pause transitions (otherwise the renderer would snap back
    // by one network RTT on each broadcast and visibly stutter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderer, serverPlaying, serverPaused]);

  // ``MSG_START`` always runs ``mark_time_zero()`` on the hub, but when
  // the user restarts *while already playing* the play/pause transition
  // effect above never fires (``serverPlaying`` was and stays true).
  // Bump ``sessionRestartGeneration`` in PlaybackProvider on every
  // ``start()`` call so we always realign the local playhead and reset
  // bar colours to match the backend.
  useEffect(() => {
    if (!renderer) return;
    if (sessionRestartGeneration === 0) return;
    renderer.startAt(0);
  }, [renderer, sessionRestartGeneration]);

  useEffect(() => {
    if (!renderer || !latestNotePlayed) return;
    if (previousNoteRef.current === latestNotePlayed) return;
    previousNoteRef.current = latestNotePlayed;
    renderer.reportPlayback(latestNotePlayed);
  }, [renderer, latestNotePlayed]);

  return rendererRef;
}
