import test from "node:test";
import assert from "node:assert/strict";

import {
  BAR_VERTICAL_GAP_PX,
  HIGHEST_MIDI,
  LOWEST_MIDI,
  MIN_BAR_HEIGHT_PX,
  barHeightPx,
  isAccidental,
  laneForPitch,
  nameForPitch,
  noteMeshKey,
  octaveForPitch,
  visibleNotes,
  yForNote,
} from "../src/renderer/timeline.js";

test("yForNote returns zero when a note lands on the hit-line", () => {
  assert.equal(yForNote({ startMs: 1000, nowMs: 1000 }), 0);
});

test("yForNote increases with remaining time at the configured speed", () => {
  const y = yForNote({ startMs: 2000, nowMs: 0, pxPerMs: 0.5 });
  assert.equal(y, 1000);
});

test("yForNote is negative after the note has passed", () => {
  const y = yForNote({ startMs: 0, nowMs: 1000, pxPerMs: 1 });
  assert.equal(y, -1000);
});

test("laneForPitch anchors the endpoints and clamps out-of-range pitches", () => {
  assert.equal(laneForPitch(LOWEST_MIDI), 0);
  assert.equal(laneForPitch(HIGHEST_MIDI), 1);
  assert.equal(laneForPitch(LOWEST_MIDI - 5), 0);
  assert.equal(laneForPitch(HIGHEST_MIDI + 5), 1);
});

test("laneForPitch rejects degenerate ranges", () => {
  assert.throws(() => laneForPitch(60, { low: 60, high: 60 }));
});

test("default MIDI range spans C2–C7 (61 keys)", () => {
  assert.equal(LOWEST_MIDI, 36);
  assert.equal(HIGHEST_MIDI, 96);
  assert.equal(HIGHEST_MIDI - LOWEST_MIDI + 1, 61);
});

test("nameForPitch returns the expected letter for common pitches", () => {
  assert.equal(nameForPitch(60), "C");   // middle C
  assert.equal(nameForPitch(61), "C♯");  // accidental uses unicode sharp
  assert.equal(nameForPitch(69), "A");   // A4
  assert.equal(nameForPitch(127), "G");  // top of the MIDI spec
  assert.equal(nameForPitch(0), "C");
});

test("nameForPitch handles negative pitches without throwing", () => {
  assert.doesNotThrow(() => nameForPitch(-1));
  assert.equal(nameForPitch(-1), "B");
  assert.equal(nameForPitch(-12), "C");
});

test("nameForPitch returns a string for every MIDI value", () => {
  for (let p = 0; p <= 127; ++p) {
    assert.equal(typeof nameForPitch(p), "string");
  }
});

test("octaveForPitch places middle C at octave 4", () => {
  assert.equal(octaveForPitch(60), 4);
  assert.equal(octaveForPitch(36), 2);
  assert.equal(octaveForPitch(96), 7);
});

test("isAccidental identifies the five black keys per octave", () => {
  const blacks = [1, 3, 6, 8, 10];
  for (let pc = 0; pc < 12; ++pc) {
    assert.equal(isAccidental(60 + pc), blacks.includes(pc));
  }
  assert.equal(isAccidental(-1), false); // -1 maps to pitch class 11 (B), a white key
  assert.equal(isAccidental(-11), true); // -11 maps to pitch class 1 (C♯)
});

test("barHeightPx subtracts the gap and clamps tiny durations", () => {
  // 100 ms at 0.25 px/ms → 25 px logical, minus 2 px gap → 23 px rendered.
  assert.equal(barHeightPx(100, 0.25, 2), 23);
  // Below the minimum, clamp to MIN_BAR_HEIGHT_PX regardless of gap.
  assert.equal(barHeightPx(1, 0.25, 2), MIN_BAR_HEIGHT_PX);
  // Default gap is applied when caller omits the argument.
  assert.equal(barHeightPx(400, 0.25), 400 * 0.25 - BAR_VERTICAL_GAP_PX);
});

test("consecutive same-lane bars leave a strictly positive vertical gap", () => {
  // Regression for the "bars are touching" complaint: two 1000 ms notes
  // back-to-back in the same lane must not visually merge. With
  // centre-anchored bars of shrunken height, the gap equals the gap
  // parameter exactly.
  const pxPerMs = 0.25;
  const durMs = 1000;
  const gap = BAR_VERTICAL_GAP_PX;
  const h = barHeightPx(durMs, pxPerMs, gap);

  const centreA = 0 * pxPerMs + (durMs * pxPerMs) / 2;
  const centreB = 1000 * pxPerMs + (durMs * pxPerMs) / 2;
  const topOfA = centreA + h / 2;
  const bottomOfB = centreB - h / 2;

  const visibleGap = bottomOfB - topOfA;
  assert.ok(visibleGap > 0, `expected a positive gap; got ${visibleGap}`);
  assert.equal(visibleGap, gap);
});

test("visibleNotes keeps only notes inside the look-ahead + tail window", () => {
  const notes = [
    { pitch: 60, start_ms: -500 },
    { pitch: 62, start_ms: 0 },
    { pitch: 64, start_ms: 1000 },
    { pitch: 65, start_ms: 5000 },
  ];
  const visible = visibleNotes(notes, 200, { leadMs: 2000, tailMs: 300 });
  assert.deepEqual(
    visible.map((n) => n.pitch),
    [62, 64],
  );
});

test("noteMeshKey prefers id over the (pitch, start_ms) composite", () => {
  // ScoreNote shape.
  assert.equal(noteMeshKey({ id: 0, pitch: 60, start_ms: 1000 }), "#0");
  // ValidationResult shape.
  assert.equal(
    noteMeshKey({ expected_id: 7, expected_pitch: 64, expected_time_ms: 1000 }),
    "#7",
  );
});

test("noteMeshKey falls back to composite when id is missing or sentinel", () => {
  // Legacy payload without id.
  assert.equal(noteMeshKey({ pitch: 60, start_ms: 1000.4 }), "60@1000");
  // ``-1`` is the "unassigned" sentinel reserved in ScoreNote; must not
  // be used as a key, or every unassigned mesh would collide on "#-1".
  assert.equal(noteMeshKey({ id: -1, pitch: 62, start_ms: 500 }), "62@500");
});

test("noteMeshKey distinguishes sub-millisecond same-pitch grace notes by id", () => {
  // TD-04 regression: two notes whose start_ms round to the same value
  // must produce different mesh keys when ids are present.
  const a = { id: 0, pitch: 60, start_ms: 1000.2 };
  const b = { id: 1, pitch: 60, start_ms: 1000.4 };
  assert.notEqual(noteMeshKey(a), noteMeshKey(b));
});

test("noteMeshKey returns null when neither id nor composite is available", () => {
  assert.equal(noteMeshKey({}), null);
  assert.equal(noteMeshKey({ correct: true }), null);
  assert.equal(noteMeshKey({ expected_pitch: 60 }), null); // missing time
});
