import { describe, expect, it } from "vitest";

import { midiPitchToRegisterIndex, MoodState } from "./mood-state";

describe("midiPitchToRegisterIndex", () => {
  it("maps MIDI to bass / mid / treble", () => {
    expect(midiPitchToRegisterIndex(36)).toBe(0);
    expect(midiPitchToRegisterIndex(55)).toBe(0);
    expect(midiPitchToRegisterIndex(56)).toBe(1);
    expect(midiPitchToRegisterIndex(76)).toBe(1);
    expect(midiPitchToRegisterIndex(77)).toBe(2);
    expect(midiPitchToRegisterIndex(108)).toBe(2);
  });
});

describe("MoodState", () => {
  it("decays energy and ripple when idle", () => {
    const m = new MoodState();
    m.onNotePlayed(
      {
        correct: null,
        delta_ms: null,
        expected_id: null,
        expected_pitch: null,
        expected_time_ms: null,
        played_pitch: 60,
        played_time_ms: 0,
      },
      0.4,
      0.7,
    );
    const hot = m.tick(0);
    expect(hot.energy).toBeGreaterThan(0.1);
    expect(hot.rippleStrength).toBe(1);
    let last = hot.energy;
    for (let i = 0; i < 40; i++) {
      const s = m.tick(0.05);
      expect(s.energy).toBeLessThanOrEqual(last + 1e-6);
      last = s.energy;
    }
    expect(m.tick(0.05).energy).toBeLessThan(0.15);
    expect(m.tick(0.05).rippleStrength).toBe(0);
  });

  it("raises bass bin for low notes and treble for high notes", () => {
    const m = new MoodState();
    m.onNotePlayed(
      {
        correct: null,
        delta_ms: null,
        expected_id: null,
        expected_pitch: null,
        expected_time_ms: null,
        played_pitch: 40,
        played_time_ms: 0,
      },
      0.5,
      0.5,
    );
    expect(m.tick(0).bass).toBeGreaterThan(0.1);
    expect(m.tick(0).treble).toBeLessThan(0.05);

    const m2 = new MoodState();
    m2.onNotePlayed(
      {
        correct: null,
        delta_ms: null,
        expected_id: null,
        expected_pitch: null,
        expected_time_ms: null,
        played_pitch: 90,
        played_time_ms: 0,
      },
      0.5,
      0.5,
    );
    expect(m2.tick(0).treble).toBeGreaterThan(0.1);
    expect(m2.tick(0).bass).toBeLessThan(0.05);
  });

  it("maps spread from held key count", () => {
    const m = new MoodState();
    m.setHeldKeyCount(0);
    expect(m.tick(0).spread).toBe(0);
    m.setHeldKeyCount(4);
    expect(m.tick(0).spread).toBe(0.5);
    m.setHeldKeyCount(16);
    expect(m.tick(0).spread).toBe(1);
  });

  it("stores ripple UV from last note", () => {
    const m = new MoodState();
    m.onNotePlayed(
      {
        correct: null,
        delta_ms: null,
        expected_id: null,
        expected_pitch: null,
        expected_time_ms: null,
        played_pitch: 60,
        played_time_ms: 0,
      },
      0.25,
      0.88,
    );
    const s = m.tick(0);
    expect(s.rippleU).toBe(0.25);
    expect(s.rippleV).toBe(0.88);
  });
});
