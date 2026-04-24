import type { NotePlayed } from "../../types/score";

/** Register bin: bass / mid / treble for FFT-like mood proxy. */
export type RegisterIndex = 0 | 1 | 2;

export interface MoodUniformSnapshot {
  bass: number;
  /** Combined activity 0–1 (drives warp / shimmer). */
  energy: number;
  /** 0–1 chromatic phase from recent pitch classes. */
  hueShift: number;
  mid: number;
  /** Ripple intensity 0–1 decaying after each note. */
  rippleStrength: number;
  /** Ripple origin in 0–1 (horizontal, vertical). */
  rippleU: number;
  rippleV: number;
  /** Polyphony 0–1 from held keys. */
  spread: number;
  /** Timing tightness proxy from |delta_ms| 0–1. */
  tension: number;
  treble: number;
  /** Smoothed follow of energy for slow domain warp. */
  warp: number;
}

const ENERGY_DECAY_PER_SEC = 1.35;
const RIPPLE_DECAY_PER_SEC = 2.4;
const REGISTER_DECAY_PER_SEC = 0.45;
const NOTE_ENERGY_BUMP = 0.32;
const ENERGY_CAP = 1.15;
const WARP_LAMBDA = 6;
const SPREAD_MAX_KEYS = 8;
const TENSION_BLEND = 0.12;
const HUE_EMA_BLEND = 0.14;
const HUE_IDLE_DECAY_PER_SEC = 0.35;

export function midiPitchToRegisterIndex(pitch: number): RegisterIndex {
  if (pitch < 56) return 0;
  if (pitch < 77) return 1;
  return 2;
}

/**
 * CPU-side envelopes from MIDI activity; drives reactive background uniforms.
 * Pure logic — testable without WebGL.
 */
export class MoodState {
  private energy = 0;
  private warp = 0;
  /** EMA of pitch-class / 12 in [0,1). */
  private hueEma = 0.5;
  private spread = 0;
  private tension = 0;
  private readonly register: [number, number, number] = [0, 0, 0];
  private rippleU = 0.5;
  private rippleV = 0.72;
  private rippleStrength = 0;

  onNotePlayed(note: NotePlayed, rippleU: number, rippleV: number): void {
    this.energy = Math.min(this.energy + NOTE_ENERGY_BUMP, ENERGY_CAP);
    this.rippleU = rippleU;
    this.rippleV = rippleV;
    this.rippleStrength = 1;

    const pc = ((note.played_pitch % 12) + 12) % 12;
    const pcNorm = pc / 12;
    this.hueEma += (pcNorm - this.hueEma) * HUE_EMA_BLEND;

    const r = midiPitchToRegisterIndex(note.played_pitch);
    this.register[r] = Math.min(this.register[r] + 0.28, 1);

    if (note.delta_ms !== null && note.delta_ms !== undefined) {
      const d = Math.min(Math.abs(note.delta_ms) / 150, 1);
      this.tension += (d - this.tension) * TENSION_BLEND;
    }

    if (note.correct === true) {
      this.tension *= 0.94;
    } else if (note.correct === false) {
      this.tension = Math.min(this.tension + 0.06, 1);
    }
  }

  setHeldKeyCount(n: number): void {
    this.spread = Math.min(Math.max(0, n) / SPREAD_MAX_KEYS, 1);
  }

  tick(dt: number): MoodUniformSnapshot {
    if (dt <= 0) {
      return this._snapshot();
    }

    this.energy = Math.max(0, this.energy - ENERGY_DECAY_PER_SEC * dt);
    this.rippleStrength = Math.max(
      0,
      this.rippleStrength - RIPPLE_DECAY_PER_SEC * dt,
    );

    for (let i = 0; i < 3; i++) {
      this.register[i] = Math.max(
        0,
        this.register[i] - REGISTER_DECAY_PER_SEC * dt,
      );
    }

    const k = 1 - Math.exp(-WARP_LAMBDA * dt);
    this.warp += (this.energy - this.warp) * k;

    this.hueEma += (0.5 - this.hueEma) * (1 - Math.exp(-HUE_IDLE_DECAY_PER_SEC * dt));

    return this._snapshot();
  }

  private _snapshot(): MoodUniformSnapshot {
    const e = Math.min(this.energy + this.warp * 0.35, 1);
    return {
      bass: this.register[0],
      energy: e,
      hueShift: this.hueEma,
      mid: this.register[1],
      rippleStrength: this.rippleStrength,
      rippleU: this.rippleU,
      rippleV: this.rippleV,
      spread: this.spread,
      tension: this.tension,
      treble: this.register[2],
      warp: this.warp,
    };
  }
}
