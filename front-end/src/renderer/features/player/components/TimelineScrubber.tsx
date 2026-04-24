import type { ScoreTimeline } from "@shared/types/score";
import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

import {
  buildTimelineBins,
  msToRatio,
  ratioToMs,
} from "../lib/timeline-preview";

const PREVIEW_BIN_COUNT = 96;

export interface TimelineScrubberProps {
  onSeek: (ms: number) => void;
  score: null | ScoreTimeline;
  serverElapsedMs: null | number;
  serverPaused: boolean;
  serverPlaybackSpeed: number;
  serverPlaying: boolean;
}

export function TimelineScrubber({
  onSeek,
  score,
  serverElapsedMs,
  serverPaused,
  serverPlaybackSpeed,
  serverPlaying,
}: TimelineScrubberProps): ReactElement {
  const railRef = useRef<HTMLDivElement | null>(null);
  const dragMsRef = useRef<null | number>(null);
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [dragMs, setDragMs] = useState<null | number>(null);
  const anchorElapsedMsRef = useRef<null | number>(serverElapsedMs ?? 0);
  const anchorWallMsRef = useRef(nowMs);

  const durationMs = score?.duration_ms ?? 0;
  const enabled = !!score && durationMs > 0 && score.notes.length > 0;
  const bins = useMemo(
    () =>
      enabled
        ? buildTimelineBins(score.notes, durationMs, PREVIEW_BIN_COUNT)
        : [],
    [enabled, score, durationMs],
  );
  useEffect(() => {
    if (typeof serverElapsedMs !== "number") return;
    anchorElapsedMsRef.current = serverElapsedMs;
    anchorWallMsRef.current = performance.now();
  }, [serverElapsedMs]);

  useEffect(() => {
    let raf = 0;
    if (serverPlaying && !serverPaused) {
      const tick = () => {
        setNowMs(performance.now());
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    setNowMs(performance.now());
    return undefined;
  }, [serverPlaying, serverPaused]);

  const anchoredMs = anchorElapsedMsRef.current ?? 0;
  const dt = Math.max(0, nowMs - anchorWallMsRef.current);
  const runningMs =
    serverPlaying && !serverPaused
      ? anchoredMs + dt * serverPlaybackSpeed
      : (typeof serverElapsedMs === "number" ? serverElapsedMs : anchoredMs);
  const effectiveMs = dragMs ?? runningMs;
  const thumbPct = enabled ? msToRatio(effectiveMs, durationMs) * 100 : 0;

  const positionToMs = (clientX: number): number => {
    const el = railRef.current;
    if (!el || !enabled) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (clientX - rect.left) / Math.max(1, rect.width);
    return ratioToMs(ratio, durationMs);
  };

  const commitSeek = (ms: number): void => {
    if (!enabled) return;
    onSeek(ms);
    dragMsRef.current = null;
    setDragMs(null);
  };

  const onRailPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!enabled) return;
    const targetMs = positionToMs(e.clientX);
    dragMsRef.current = targetMs;
    setDragMs(targetMs);
    const onMove = (ev: PointerEvent) => {
      const next = positionToMs(ev.clientX);
      dragMsRef.current = next;
      setDragMs(next);
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const next = Number.isFinite(ev.clientX)
        ? positionToMs(ev.clientX)
        : dragMsRef.current ?? targetMs;
      commitSeek(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className="timeline" data-enabled={enabled ? "1" : "0"}>
      <div className="timeline-label">Timeline</div>
      <div
        aria-label="Score timeline scrubber"
        className="timeline-scrubber"
        onPointerDown={onRailPointerDown}
        ref={railRef}
        role="slider"
        tabIndex={enabled ? 0 : -1}
      >
        <div className="timeline-scrubber__bins">
          {bins.map((bin, i) => (
            <span
              className="timeline-scrubber__bin"
              key={i}
              style={{ height: `${Math.max(8, Math.round(bin.density * 100))}%` }}
            />
          ))}
        </div>
        <div
          className="timeline-scrubber__thumb"
          style={{ left: `${thumbPct}%` }}
        />
      </div>
    </div>
  );
}
