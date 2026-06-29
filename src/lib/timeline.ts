export const LOWEST_MIDI = 36;
export const HIGHEST_MIDI = 96;

export const DEFAULT_PX_PER_MS = 0.25;
export const DEFAULT_LEAD_MS = 3000;
export const BAR_VERTICAL_GAP_PX = 2;
export const MIN_BAR_HEIGHT_PX = 4;

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export function nameForPitch(pitch: number): string {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}

export function octaveForPitch(pitch: number): number {
  return Math.floor(pitch / 12) - 1;
}

export function isAccidental(pitch: number): boolean {
  const pc = ((pitch % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

export function isWhiteKey(pitch: number): boolean {
  return !isAccidental(pitch);
}

export function isBlackKey(pitch: number): boolean {
  return isAccidental(pitch);
}

export function yForNote({
  nowMs,
  pxPerMs = DEFAULT_PX_PER_MS,
  startMs,
}: {
  nowMs: number;
  pxPerMs?: number;
  startMs: number;
}): number {
  return (startMs - nowMs) * pxPerMs;
}

export function barHeightPx(
  durationMs: number,
  pxPerMs: number = DEFAULT_PX_PER_MS,
  gapPx: number = BAR_VERTICAL_GAP_PX,
): number {
  return Math.max(MIN_BAR_HEIGHT_PX, durationMs * pxPerMs - gapPx);
}

export type NoteKeyInput = {
  id?: number | null;
  expected_id?: number | null;
  pitch?: number | null;
  expected_pitch?: number | null;
  start_ms?: number | null;
  expected_time_ms?: number | null;
};

export function noteMeshKey(input: NoteKeyInput = {}): string | null {
  const effectiveId = input.id ?? input.expected_id;
  if (effectiveId != null && effectiveId >= 0) {
    return `#${effectiveId}`;
  }
  const effectivePitch = input.pitch ?? input.expected_pitch;
  const effectiveStart = input.start_ms ?? input.expected_time_ms;
  if (effectivePitch == null || effectiveStart == null) return null;
  return `${effectivePitch}@${Math.round(effectiveStart)}`;
}
