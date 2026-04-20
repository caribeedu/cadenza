// Pure functions that map score-note timings onto the waterfall's vertical
// axis. Kept DOM/Three-free so they can be unit-tested under `node --test`.

export const DEFAULT_PX_PER_MS = 0.25;   // 4 s of lookahead on a 1000px canvas
export const DEFAULT_LEAD_MS = 3000;     // how far ahead of t=0 notes spawn
// 61-key range: C2–C7, matching Yousician / Simply Piano and most beginner
// digital keyboards. Pitches outside the range are clamped to the edge lanes
// by `laneForPitch` so the waterfall still shows them.
export const LOWEST_MIDI = 36;           // C2
export const HIGHEST_MIDI = 96;          // C7

// Visible vertical spacing between consecutive same-lane bars. Bars are
// centred on their (start, start+duration) time interval; shrinking the
// rendered height by this constant leaves half on each side, producing a
// consistent visible gap between back-to-back notes so they no longer
// look like one long bar.
export const BAR_VERTICAL_GAP_PX = 2;
export const MIN_BAR_HEIGHT_PX = 4;

// Unicode sharps read better than "#" and match engraved sheet music.
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/**
 * Map a MIDI pitch to a human-readable note letter (`C`, `C♯`, `D`, ...).
 * The octave is intentionally omitted — the keyboard lane already conveys
 * that, and the extra digits clutter the waterfall at small label sizes.
 */
export function nameForPitch(pitch) {
  return NOTE_NAMES[((pitch % 12) + 12) % 12];
}

/** Return the octave number for a MIDI pitch (C4 == middle C == octave 4). */
export function octaveForPitch(pitch) {
  return Math.floor(pitch / 12) - 1;
}

/** Pitch classes that correspond to black keys (C♯, D♯, F♯, G♯, A♯). */
export function isAccidental(pitch) {
  const pc = ((pitch % 12) + 12) % 12;
  return pc === 1 || pc === 3 || pc === 6 || pc === 8 || pc === 10;
}

/**
 * Return the vertical offset (in pixels, relative to the hit-line at y=0
 * which is *bottom* in screen coordinates) for a note with the given start
 * time, at the current playback time.
 *
 * Positive values move the note up (further in the future); at y=0 the note
 * sits on the hit-line; negative values mean the note has already been
 * missed.
 */
export function yForNote({ startMs, nowMs, pxPerMs = DEFAULT_PX_PER_MS }) {
  return (startMs - nowMs) * pxPerMs;
}

/**
 * Return the rendered height (in pixels) of a note bar whose logical
 * duration is `durationMs`. The returned height is shorter than the full
 * logical length by `gapPx`, ensuring adjacent same-lane notes don't
 * visually merge.
 *
 * The centre of the bar is expected to stay on the logical
 * `(start, start+duration)` midpoint, so the gap manifests symmetrically
 * on both ends — half above, half below — preserving correct timing.
 */
export function barHeightPx(durationMs, pxPerMs = DEFAULT_PX_PER_MS, gapPx = BAR_VERTICAL_GAP_PX) {
  return Math.max(MIN_BAR_HEIGHT_PX, durationMs * pxPerMs - gapPx);
}

/**
 * Map a MIDI pitch to a normalised lane in [0, 1] across the visible keyboard
 * range.
 */
export function laneForPitch(
  pitch,
  { low = LOWEST_MIDI, high = HIGHEST_MIDI } = {}
) {
  if (high <= low) throw new Error("high must be greater than low");
  const clamped = Math.max(low, Math.min(high, pitch));
  return (clamped - low) / (high - low);
}

/**
 * Pick the notes that are worth rendering at ``nowMs`` — anything between
 * ``nowMs - tail`` and ``nowMs + lead`` milliseconds.
 */
export function visibleNotes(notes, nowMs, { leadMs = DEFAULT_LEAD_MS, tailMs = 400 } = {}) {
  const from = nowMs - tailMs;
  const to = nowMs + leadMs;
  return notes.filter((n) => n.start_ms >= from && n.start_ms <= to);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Canonical lookup key for a scored note in the waterfall's mesh map.
 *
 * Preference order:
 *   1. ``id`` from the backend (stable, collision-free).
 *   2. ``(pitch, startMs)`` composite fallback for payloads that still
 *      omit ``id`` — round ``startMs`` to the nearest millisecond so
 *      small float drift in the ingest pipeline doesn't keep us from
 *      finding an existing mesh.
 *
 * The function is lenient by design: passing either a ScoreNote-shaped
 * object (``{ id, pitch, start_ms }``) or a ValidationResult-shaped one
 * (``{ expected_id, expected_pitch, expected_time_ms }``) both work.
 *
 * Returns ``null`` when neither an ``id`` nor a ``(pitch, startMs)``
 * pair is available — callers treat that as "no bar to colour".
 */
export function noteMeshKey({ id, pitch, start_ms, expected_id, expected_pitch, expected_time_ms } = {}) {
  const effectiveId = id ?? expected_id;
  if (effectiveId !== null && effectiveId !== undefined && effectiveId >= 0) {
    return `#${effectiveId}`;
  }
  const effectivePitch = pitch ?? expected_pitch;
  const effectiveStart = start_ms ?? expected_time_ms;
  if (effectivePitch === null || effectivePitch === undefined) return null;
  if (effectiveStart === null || effectiveStart === undefined) return null;
  return `${effectivePitch}@${Math.round(effectiveStart)}`;
}
