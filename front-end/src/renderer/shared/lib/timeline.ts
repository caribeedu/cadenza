import type { NotePlayed, ScoreNote } from "../types/score";

export const DEFAULT_PX_PER_MS = 0.25;
export const DEFAULT_LEAD_MS = 3000;

export const LOWEST_MIDI = 36;
export const HIGHEST_MIDI = 96;

export const BAR_VERTICAL_GAP_PX = 2;
export const MIN_BAR_HEIGHT_PX = 4;

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
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

export interface YForNoteArgs {
  nowMs: number;
  pxPerMs?: number;
  startMs: number;
}

export function yForNote({
  nowMs,
  pxPerMs = DEFAULT_PX_PER_MS,
  startMs,
}: YForNoteArgs): number {
  return (startMs - nowMs) * pxPerMs;
}

export function barHeightPx(
  durationMs: number,
  pxPerMs: number = DEFAULT_PX_PER_MS,
  gapPx: number = BAR_VERTICAL_GAP_PX,
): number {
  return Math.max(MIN_BAR_HEIGHT_PX, durationMs * pxPerMs - gapPx);
}

export interface LaneRangeOptions {
  high?: number;
  low?: number;
}

export function laneForPitch(
  pitch: number,
  { high = HIGHEST_MIDI, low = LOWEST_MIDI }: LaneRangeOptions = {},
): number {
  if (high <= low) throw new Error("high must be greater than low");
  const clamped = Math.max(low, Math.min(high, pitch));
  return (clamped - low) / (high - low);
}

export interface VisibleNotesOptions {
  leadMs?: number;
  tailMs?: number;
}

export function visibleNotes<T extends { start_ms: number }>(
  notes: T[],
  nowMs: number,
  { leadMs = DEFAULT_LEAD_MS, tailMs = 400 }: VisibleNotesOptions = {},
): T[] {
  const from = nowMs - tailMs;
  const to = nowMs + leadMs;
  return notes.filter((n) => n.start_ms >= from && n.start_ms <= to);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Canonical lookup key for a scored note in the waterfall's mesh map.
// Prefers the backend-assigned id; falls back to (pitch, start_ms) for
// payloads that omit it. Accepts either ScoreNote or NotePlayed
// shapes. See TECH-DEBTS.md → TD-04 for the collision case.
export type NoteKeyInput =
  | Partial<NotePlayed>
  | Partial<ScoreNote>
  | Record<string, unknown>;

export function noteMeshKey(input: NoteKeyInput = {}): null | string {
  const id = (input as { id?: null | number }).id;
  const expectedId = (input as { expected_id?: null | number }).expected_id;
  const effectiveId = id ?? expectedId;
  if (effectiveId !== null && effectiveId !== undefined && effectiveId >= 0) {
    return `#${effectiveId}`;
  }
  const pitch = (input as { pitch?: null | number }).pitch;
  const expectedPitch = (input as { expected_pitch?: null | number })
    .expected_pitch;
  const startMs = (input as { start_ms?: null | number }).start_ms;
  const expectedTime = (input as { expected_time_ms?: null | number })
    .expected_time_ms;
  const effectivePitch = pitch ?? expectedPitch;
  const effectiveStart = startMs ?? expectedTime;
  if (effectivePitch === null || effectivePitch === undefined) return null;
  if (effectiveStart === null || effectiveStart === undefined) return null;
  return `${effectivePitch}@${Math.round(effectiveStart)}`;
}
