import * as THREE from "three";

const POOL = 400;
const LIFE_BURST = 0.45;
const LIFE_STREAM = 0.5;
/** Position / velocity scale vs original tuning (~+20% spread). */
const BURST_SPREAD = 1.2;

/**
 * Additive sparks at the strike line. Uses **constant screen size** points
 * (`sizeAttenuation: false`) so they stay visible under an
 * ``OrthographicCamera`` (with ``true``, points often shrink to invisibility).
 */
export class WaterfallImpactParticles {
  private readonly _alive: Uint8Array;
  private readonly _geom: THREE.BufferGeometry;
  private readonly _life: Float32Array;
  private readonly _mat: THREE.PointsMaterial;
  private readonly _pos: Float32Array;
  private readonly _vel: Float32Array;
  private _idx = 0;
  private _streamCarry = 0;
  private readonly _tex: THREE.DataTexture;
  private readonly _points: THREE.Points;

  constructor() {
    const pos = new Float32Array(POOL * 3);
    this._pos = pos;
    this._vel = new Float32Array(POOL * 3);
    this._life = new Float32Array(POOL);
    this._alive = new Uint8Array(POOL);

    this._geom = new THREE.BufferGeometry();
    this._geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this._geom.setDrawRange(0, POOL);

    this._tex = this._makeSpriteTexture();
    this._mat = new THREE.PointsMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xffcc88,
      depthTest: false,
      depthWrite: false,
      map: this._tex,
      opacity: 0.9,
      size: 12,
      sizeAttenuation: false,
      transparent: true,
    });
    this._mat.toneMapped = false;
    this._points = new THREE.Points(this._geom, this._mat);
    this._points.renderOrder = 10;
    this._points.frustumCulled = false;
  }

  private _makeSpriteTexture(): THREE.DataTexture {
    const s = 32;
    const d = new Uint8Array(s * s * 4);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = x - s * 0.5;
        const dy = y - s * 0.5;
        const r = (s * 0.5 - Math.hypot(dx, dy)) / (s * 0.5);
        const t = Math.max(0, Math.min(1, r));
        const a = t * t * 255;
        const i = (y * s + x) * 4;
        d[i] = 255;
        d[i + 1] = 230;
        d[i + 2] = 200;
        d[i + 3] = a;
      }
    }
    const tex = new THREE.DataTexture(d, s, s, THREE.RGBAFormat);
    tex.needsUpdate = true;
    tex.premultiplyAlpha = false;
    return tex;
  }

  get object(): THREE.Points {
    return this._points;
  }

  private _emitBlock(worldX: number, worldY: number, n: number, life: number) {
    const s = BURST_SPREAD;
    for (let k = 0; k < n; k++) {
      const i = (this._idx + k) % POOL;
      this._life[i] = life;
      this._alive[i] = 1;
      this._pos[i * 3] = worldX + (Math.random() - 0.5) * (6 * s);
      this._pos[i * 3 + 1] = worldY + (Math.random() - 0.5) * (2 * s);
      this._pos[i * 3 + 2] = (Math.random() - 0.5) * (0.15 * s);
      this._vel[i * 3] = (Math.random() - 0.5) * (90 * s);
      this._vel[i * 3 + 1] = (35 + Math.random() * 120) * s;
      this._vel[i * 3 + 2] = (Math.random() - 0.5) * (25 * s);
    }
    this._idx = (this._idx + n) % POOL;
  }

  /** Wider than {@link _emitBlock}: sustain used to coalesce into one add+bloom disc. */
  private _emitSustainBlock(
    worldX: number,
    worldY: number,
    n: number,
    life: number,
  ) {
    const s = BURST_SPREAD;
    for (let k = 0; k < n; k++) {
      const i = (this._idx + k) % POOL;
      this._life[i] = life;
      this._alive[i] = 1;
      this._pos[i * 3] = worldX + (Math.random() - 0.5) * (28 * s);
      this._pos[i * 3 + 1] = worldY + (Math.random() - 0.5) * (10 * s);
      this._pos[i * 3 + 2] = (Math.random() - 0.5) * (0.45 * s);
      this._vel[i * 3] = (Math.random() - 0.5) * (100 * s);
      this._vel[i * 3 + 1] = (20 + Math.random() * 95) * s;
      this._vel[i * 3 + 2] = (Math.random() - 0.5) * (30 * s);
    }
    this._idx = (this._idx + n) % POOL;
  }

  /**
   * One-shot (e.g. validated hit from server). Always emits at least a few
   * particles.
   */
  burst(worldX: number, worldY: number, n: number): void {
    const c = Math.max(8, n);
    this._emitBlock(worldX, worldY, Math.min(c, 48), LIFE_BURST);
  }

  /**
   * Drop queued sustain spawns (call when the last key is released so
   * particles taper from existing pool only).
   */
  resetSustainEmission(): void {
    this._streamCarry = 0;
  }

  /**
   * While a key is held: fractional spawns each frame so sparks continue
   * for the full press duration. Uses {@link _emitSustainBlock} (wider
   * spread) so sustain does not form one additive+bloom “orb”.
   */
  streamAtLine(
    worldX: number,
    worldY: number,
    dt: number,
    ratePerSec: number,
  ): void {
    if (dt <= 0) return;
    this._streamCarry += ratePerSec * dt;
    let n = Math.floor(this._streamCarry);
    this._streamCarry -= n;
    n = Math.min(12, n);
    if (n < 1) return;
    this._emitSustainBlock(worldX, worldY, n, LIFE_STREAM);
  }

  dispose(): void {
    this._geom.dispose();
    this._tex.dispose();
    this._mat.dispose();
  }

  tick(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < POOL; i++) {
      if (!this._alive[i]) continue;
      this._life[i] -= dt;
      if (this._life[i] <= 0) {
        this._alive[i] = 0;
        this._pos[i * 3] = 0;
        this._pos[i * 3 + 1] = -1e5;
        this._pos[i * 3 + 2] = 0;
        continue;
      }
      this._pos[i * 3] += this._vel[i * 3] * dt;
      this._pos[i * 3 + 1] += this._vel[i * 3 + 1] * dt;
      this._pos[i * 3 + 2] += this._vel[i * 3 + 2] * dt;
      this._vel[i * 3 + 1] += 12 * dt;
    }
    const a = this._geom.getAttribute("position") as THREE.BufferAttribute;
    a.needsUpdate = true;
  }
}
