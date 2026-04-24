import type { ScoreNote } from "@shared/types/score";

export interface TimelineBin {
  density: number;
}

export function clampTimelineMs(ms: number, durationMs: number): number {
  if (!Number.isFinite(ms)) return 0;
  const d = Math.max(1, Math.round(durationMs));
  return Math.max(0, Math.min(d, Math.round(ms)));
}

export function msToRatio(ms: number, durationMs: number): number {
  const d = Math.max(1, durationMs);
  return clampTimelineMs(ms, d) / d;
}

export function ratioToMs(ratio: number, durationMs: number): number {
  const d = Math.max(1, durationMs);
  if (!Number.isFinite(ratio)) return 0;
  return clampTimelineMs(ratio * d, d);
}

/** Compress full score into fixed-width density bins for tiny timeline preview. */
export function buildTimelineBins(
  notes: readonly ScoreNote[],
  durationMs: number,
  binCount: number,
): TimelineBin[] {
  const bins = Array.from({ length: Math.max(1, binCount) }, () => 0);
  const d = Math.max(1, durationMs);
  for (const note of notes) {
    const ratio = Math.max(0, Math.min(1, note.start_ms / d));
    const i = Math.min(bins.length - 1, Math.floor(ratio * bins.length));
    bins[i] += 1;
  }
  const peak = Math.max(1, ...bins);
  return bins.map((count) => ({
    density: Math.sqrt(count / peak),
  }));
}
