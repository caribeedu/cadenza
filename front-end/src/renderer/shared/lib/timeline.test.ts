import {
  BAR_VERTICAL_GAP_PX,
  barHeightPx,
  HIGHEST_MIDI,
  isAccidental,
  laneForPitch,
  LOWEST_MIDI,
  MIN_BAR_HEIGHT_PX,
  nameForPitch,
  noteMeshKey,
  octaveForPitch,
  visibleNotes,
  yForNote,
} from "./timeline";
import { describe, expect, it } from "vitest";

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

describe("laneForPitch", () => {
  it("anchors the endpoints and clamps out-of-range pitches", () => {
    expect(laneForPitch(LOWEST_MIDI)).toBe(0);
    expect(laneForPitch(HIGHEST_MIDI)).toBe(1);
    expect(laneForPitch(LOWEST_MIDI - 5)).toBe(0);
    expect(laneForPitch(HIGHEST_MIDI + 5)).toBe(1);
  });

  it("rejects degenerate ranges", () => {
    expect(() => laneForPitch(60, { high: 60, low: 60 })).toThrow();
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
    expect(nameForPitch(61)).toBe("C♯");
    expect(nameForPitch(69)).toBe("A");
    expect(nameForPitch(127)).toBe("G");
    expect(nameForPitch(0)).toBe("C");
  });

  it("handles negative pitches without throwing", () => {
    expect(() => nameForPitch(-1)).not.toThrow();
    expect(nameForPitch(-1)).toBe("B");
    expect(nameForPitch(-12)).toBe("C");
  });

  it("returns a string for every MIDI value", () => {
    for (let p = 0; p <= 127; ++p) {
      expect(typeof nameForPitch(p)).toBe("string");
    }
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
    for (let pc = 0; pc < 12; ++pc) {
      expect(isAccidental(60 + pc)).toBe(blacks.includes(pc));
    }
    expect(isAccidental(-1)).toBe(false);
    expect(isAccidental(-11)).toBe(true);
  });
});

describe("barHeightPx", () => {
  it("subtracts the gap and clamps tiny durations", () => {
    expect(barHeightPx(100, 0.25, 2)).toBe(23);
    expect(barHeightPx(1, 0.25, 2)).toBe(MIN_BAR_HEIGHT_PX);
    expect(barHeightPx(400, 0.25)).toBe(400 * 0.25 - BAR_VERTICAL_GAP_PX);
  });

  it("leaves a strictly positive gap between consecutive same-lane bars", () => {
    const pxPerMs = 0.25;
    const durMs = 1000;
    const gap = BAR_VERTICAL_GAP_PX;
    const h = barHeightPx(durMs, pxPerMs, gap);

    const centreA = 0 * pxPerMs + (durMs * pxPerMs) / 2;
    const centreB = 1000 * pxPerMs + (durMs * pxPerMs) / 2;
    const topOfA = centreA + h / 2;
    const bottomOfB = centreB - h / 2;

    expect(bottomOfB - topOfA).toBe(gap);
  });
});

describe("visibleNotes", () => {
  it("keeps only notes inside the look-ahead + tail window", () => {
    const notes = [
      { pitch: 60, start_ms: -500 },
      { pitch: 62, start_ms: 0 },
      { pitch: 64, start_ms: 1000 },
      { pitch: 65, start_ms: 5000 },
    ];
    const visible = visibleNotes(notes, 200, { leadMs: 2000, tailMs: 300 });
    expect(visible.map((n) => n.pitch)).toEqual([62, 64]);
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

  it("falls back to composite when id is missing or sentinel", () => {
    expect(noteMeshKey({ pitch: 60, start_ms: 1000.4 })).toBe("60@1000");
    expect(noteMeshKey({ id: -1, pitch: 62, start_ms: 500 })).toBe("62@500");
  });

  it("distinguishes sub-millisecond same-pitch grace notes by id", () => {
    const a = { id: 0, pitch: 60, start_ms: 1000.2 };
    const b = { id: 1, pitch: 60, start_ms: 1000.4 };
    expect(noteMeshKey(a)).not.toBe(noteMeshKey(b));
  });

  it("returns null when neither id nor composite is available", () => {
    expect(noteMeshKey({})).toBeNull();
    expect(noteMeshKey({ correct: true })).toBeNull();
    expect(noteMeshKey({ expected_pitch: 60 })).toBeNull();
  });
});
