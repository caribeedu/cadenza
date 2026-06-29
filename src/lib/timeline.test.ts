import { describe, expect, it } from "vitest";

import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  HIGHEST_MIDI,
  isAccidental,
  LOWEST_MIDI,
  MIN_BAR_HEIGHT_PX,
  nameForPitch,
  noteMeshKey,
  octaveForPitch,
  yForNote,
} from "./timeline";

describe("yForNote", () => {
  it("returns zero when a note lands on the hit-line", () => {
    expect(yForNote({ nowMs: 1000, startMs: 1000 })).toBe(0);
  });

  it("increases with remaining time at the configured speed", () => {
    expect(yForNote({ nowMs: 0, pxPerMs: 0.5, startMs: 2000 })).toBe(1000);
  });

  it("is negative after the note has passed", () => {
    expect(yForNote({ nowMs: 1000, pxPerMs: 1, startMs: 0 })).toBe(-1000);
  });
});

describe("default MIDI range", () => {
  it("spans C2–C7 (61 keys)", () => {
    expect(LOWEST_MIDI).toBe(36);
    expect(HIGHEST_MIDI).toBe(96);
    expect(HIGHEST_MIDI - LOWEST_MIDI + 1).toBe(61);
  });
});

describe("nameForPitch", () => {
  it("returns the expected letter for common pitches", () => {
    expect(nameForPitch(60)).toBe("C");
    expect(nameForPitch(61)).toBe("C#");
    expect(nameForPitch(69)).toBe("A");
  });
});

describe("octaveForPitch", () => {
  it("places middle C at octave 4", () => {
    expect(octaveForPitch(60)).toBe(4);
    expect(octaveForPitch(36)).toBe(2);
    expect(octaveForPitch(96)).toBe(7);
  });
});

describe("isAccidental", () => {
  it("identifies the five black keys per octave", () => {
    const blacks = [1, 3, 6, 8, 10];
    for (let pc = 0; pc < 12; pc++) {
      expect(isAccidental(60 + pc)).toBe(blacks.includes(pc));
    }
  });
});

describe("barHeightPx", () => {
  it("subtracts the gap and clamps tiny durations", () => {
    expect(barHeightPx(100, 0.25, 2)).toBe(23);
    expect(barHeightPx(1, 0.25, 2)).toBe(MIN_BAR_HEIGHT_PX);
    expect(barHeightPx(400, 0.25)).toBe(400 * 0.25 - BAR_VERTICAL_GAP_PX);
  });
});

describe("noteMeshKey", () => {
  it("prefers id over the (pitch, start_ms) composite", () => {
    expect(noteMeshKey({ id: 0, pitch: 60, start_ms: 1000 })).toBe("#0");
    expect(
      noteMeshKey({
        expected_id: 7,
        expected_pitch: 64,
        expected_time_ms: 1000,
      }),
    ).toBe("#7");
  });

  it("falls back to composite when id is missing", () => {
    expect(noteMeshKey({ pitch: 60, start_ms: 1000.4 })).toBe("60@1000");
  });

  it("returns null when neither id nor composite is available", () => {
    expect(noteMeshKey({})).toBeNull();
  });
});
