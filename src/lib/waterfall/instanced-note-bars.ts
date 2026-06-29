import * as THREE from "three";
import type { LaneGeometry } from "../geometry";
import { BAR_VERTICAL_GAP_PX, barHeightPx, noteMeshKey, yForNote } from "../timeline";
import { feedbackColor, type WaterfallTheme } from "./theme";
import type { NoteStatus, ScoreNote } from "./note-factory";

/**
 * Use instanced draw path at or above this note count (see `large-score.json`).
 *
 * Instanced mode draws lava bars only — finger labels and note sprites are
 * omitted to keep draw calls low on large scores. Scores below the threshold
 * (or non-lava themes) use per-note meshes with sprites.
 */
export const NOTE_INSTANCING_THRESHOLD = 60;

export function shouldUseNoteInstancing(noteCount: number, lavaBars: boolean): boolean {
  return lavaBars && noteCount >= NOTE_INSTANCING_THRESHOLD;
}

type NoteMeta = {
  durationMs: number;
  pitch: number;
  startMs: number;
};

const VERT = /* glsl */ `
attribute float instancePitch;
attribute float instanceStaff;
attribute float instanceStatus;
varying vec2 vUv;
varying float vPitch;
varying float vStaff;
varying float vStatus;
void main() {
  vUv = uv;
  vPitch = instancePitch;
  vStaff = instanceStaff;
  vStatus = instanceStatus;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
varying float vPitch;
varying float vStaff;
varying float vStatus;
uniform vec3 uGradLow;
uniform vec3 uGradHigh;
uniform vec3 uHandLeft;
uniform vec3 uHandRight;
uniform vec3 uGood;
uniform vec3 uBad;
uniform float uTime;
uniform float uPitchSpan;
uniform float uPitchLo;
uniform vec2 uNoiseUvScale;
uniform float uNoiseTimeScale;
uniform float uNoiseValueBase;
uniform float uNoiseValueAmp;
uniform float uMixGood;
uniform float uMixBad;
uniform float uHandTintMix;
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float n2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p) {
  float t = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) {
    t += a * n2(p);
    p = m * p;
    a *= 0.5;
  }
  return t;
}
void main() {
  float t = uPitchSpan > 0.0 ? clamp((vPitch - uPitchLo) / uPitchSpan, 0.0, 1.0) : 0.0;
  vec3 colorLow = mix(uGradLow, uGradHigh, t * 0.25);
  vec3 colorHigh = mix(uGradLow, uGradHigh, t * 0.25 + 0.65);
  bool leftHand = vStaff > 0.5 || (vStaff < 0.5 && vPitch < 60.0);
  vec3 handTint = leftHand ? uHandLeft : uHandRight;
  vec2 uv = vUv;
  float f = fbm(uv * uNoiseUvScale + vec2(0.0, uTime * uNoiseTimeScale));
  float n = uNoiseValueBase + uNoiseValueAmp * f;
  vec3 base = mix(colorLow, colorHigh, uv.y) * n;
  vec3 handBias = mix(base * handTint, handTint * (0.4 + 0.6 * n), 0.36);
  base = mix(base, handBias, uHandTintMix);
  vec3 c = base;
  int status = int(vStatus + 0.5);
  if (status == 1) c = mix(base, uGood, uMixGood);
  else if (status == 2) c = mix(base, uBad, uMixBad);
  gl_FragColor = vec4(c, 1.0);
}
`;

function createInstancedLavaMaterial(theme: WaterfallTheme): THREE.ShaderMaterial {
  const lava = theme.lavaAppearance;
  const grad = theme.pendingGradient;
  const good = new THREE.Color(feedbackColor(theme, "good"));
  const bad = new THREE.Color(feedbackColor(theme, "bad"));
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: FRAG,
    uniforms: {
      uBad: { value: new THREE.Vector3(bad.r, bad.g, bad.b) },
      uGood: { value: new THREE.Vector3(good.r, good.g, good.b) },
      uGradLow: { value: new THREE.Color(grad.low) },
      uGradHigh: { value: new THREE.Color(grad.high) },
      uHandLeft: { value: new THREE.Color(lava.handLeftTint) },
      uHandRight: { value: new THREE.Color(lava.handRightTint) },
      uHandTintMix: { value: lava.handTintMix },
      uMixBad: { value: lava.mixBad },
      uMixGood: { value: lava.mixGood },
      uNoiseTimeScale: { value: lava.noiseTimeScale },
      uNoiseUvScale: { value: new THREE.Vector2(lava.noiseUvScaleX, lava.noiseUvScaleY) },
      uNoiseValueAmp: { value: lava.noiseValueAmp },
      uNoiseValueBase: { value: lava.noiseValueBase },
      uPitchLo: { value: 21 },
      uPitchSpan: { value: 87 },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
  });
}

function statusToFloat(status: NoteStatus): number {
  if (status === "good") return 1;
  if (status === "bad") return 2;
  return 0;
}

export class InstancedNoteBars {
  readonly mesh: THREE.InstancedMesh;
  private readonly _keys: (string | null)[];
  private readonly _keyIndex = new Map<string, number>();
  private readonly _meta: NoteMeta[];
  private readonly _statusAttr: THREE.InstancedBufferAttribute;
  private readonly _matrix = new THREE.Matrix4();
  private readonly _scale = new THREE.Vector3();
  private readonly _position = new THREE.Vector3();
  private readonly _statuses: NoteStatus[];
  private readonly _laneWidthFactor: number;

  constructor(
    notes: ScoreNote[],
    laneGeometry: LaneGeometry,
    pxPerMs: number,
    theme: WaterfallTheme,
  ) {
    const depth = theme.noteBarGeometry.depth;
    this._laneWidthFactor = theme.noteBarGeometry.laneWidthFactor;
    const geom = new THREE.BoxGeometry(1, 1, depth);
    const mat = createInstancedLavaMaterial(theme);
    this.mesh = new THREE.InstancedMesh(geom, mat, notes.length);
    this.mesh.frustumCulled = false;

    const pitches = new Float32Array(notes.length);
    const staffs = new Float32Array(notes.length);
    const statuses = new Float32Array(notes.length);
    this._statusAttr = new THREE.InstancedBufferAttribute(statuses, 1);
    geom.setAttribute("instancePitch", new THREE.InstancedBufferAttribute(pitches, 1));
    geom.setAttribute("instanceStaff", new THREE.InstancedBufferAttribute(staffs, 1));
    geom.setAttribute("instanceStatus", this._statusAttr);

    this._keys = [];
    this._meta = [];
    this._statuses = [];

    for (let i = 0; i < notes.length; i++) {
      const n = notes[i]!;
      const key = noteMeshKey(n);
      this._keys.push(key);
      if (key) this._keyIndex.set(key, i);
      pitches[i] = n.pitch;
      staffs[i] = n.staff ?? 0;
      statuses[i] = 0;
      this._statuses.push("pending");
      this._meta.push({
        durationMs: n.duration_ms,
        pitch: n.pitch,
        startMs: n.start_ms,
      });
      this._setInstanceMatrix(i, n.pitch, n.duration_ms, laneGeometry, pxPerMs, 0, 0, 0);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this._statusAttr.needsUpdate = true;
  }

  applyTheme(theme: WaterfallTheme): void {
    const mat = this.mesh.material as THREE.ShaderMaterial;
    const lava = theme.lavaAppearance;
    const grad = theme.pendingGradient;
    const good = new THREE.Color(feedbackColor(theme, "good"));
    const bad = new THREE.Color(feedbackColor(theme, "bad"));
    mat.uniforms.uGradLow.value.setHex(grad.low);
    mat.uniforms.uGradHigh.value.setHex(grad.high);
    mat.uniforms.uHandLeft.value.setHex(lava.handLeftTint);
    mat.uniforms.uHandRight.value.setHex(lava.handRightTint);
    mat.uniforms.uHandTintMix.value = lava.handTintMix;
    mat.uniforms.uMixGood.value = lava.mixGood;
    mat.uniforms.uMixBad.value = lava.mixBad;
    mat.uniforms.uNoiseTimeScale.value = lava.noiseTimeScale;
    (mat.uniforms.uNoiseUvScale.value as THREE.Vector2).set(
      lava.noiseUvScaleX,
      lava.noiseUvScaleY,
    );
    mat.uniforms.uNoiseValueAmp.value = lava.noiseValueAmp;
    mat.uniforms.uNoiseValueBase.value = lava.noiseValueBase;
    mat.uniforms.uGood.value.set(good.r, good.g, good.b);
    mat.uniforms.uBad.value.set(bad.r, bad.g, bad.b);
  }

  setLavaTime(t: number): void {
    (this.mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  }

  getIndex(key: string): number | undefined {
    return this._keyIndex.get(key);
  }

  setStatus(index: number, status: NoteStatus): void {
    if (index < 0 || index >= this._statuses.length) return;
    this._statuses[index] = status;
    (this._statusAttr.array as Float32Array)[index] = statusToFloat(status);
    this._statusAttr.needsUpdate = true;
  }

  setStatusByKey(key: string, status: NoteStatus): void {
    const idx = this._keyIndex.get(key);
    if (idx != null) this.setStatus(idx, status);
  }

  resetAllPending(): void {
    const arr = this._statusAttr.array as Float32Array;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = 0;
      this._statuses[i] = "pending";
    }
    this._statusAttr.needsUpdate = true;
  }

  updateLayout(
    nowMs: number,
    laneGeometry: LaneGeometry,
    pxPerMs: number,
    strikeLineY: number,
    cameraBottom: number,
    cameraTop: number,
    canvasWidth: number,
  ): void {
    for (let i = 0; i < this._meta.length; i++) {
      const m = this._meta[i]!;
      const hPx = barHeightPx(m.durationMs, pxPerMs, BAR_VERTICAL_GAP_PX);
      const y =
        yForNote({ nowMs, pxPerMs, startMs: m.startMs }) + hPx / 2 + strikeLineY;
      const x = laneGeometry.laneCenterPx(m.pitch) - canvasWidth / 2;
      const visible = y > cameraBottom - 50 && y < cameraTop + 50;
      if (visible) {
        this._setInstanceMatrix(i, m.pitch, m.durationMs, laneGeometry, pxPerMs, x, y, hPx);
      } else {
        this._hideInstance(i);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  private _hideInstance(index: number): void {
    this._scale.set(0, 0, 0);
    this._position.set(0, -1e6, 0);
    this._matrix.compose(this._position, new THREE.Quaternion(), this._scale);
    this.mesh.setMatrixAt(index, this._matrix);
  }

  private _setInstanceMatrix(
    index: number,
    pitch: number,
    durationMs: number,
    laneGeometry: LaneGeometry,
    pxPerMs: number,
    x: number,
    y: number,
    hPx: number,
  ): void {
    const laneWidth = laneGeometry.laneWidthPx(pitch);
    const width = Math.max(3, laneWidth * this._laneWidthFactor);
    const height = hPx > 0 ? hPx : barHeightPx(durationMs, pxPerMs, BAR_VERTICAL_GAP_PX);
    this._position.set(x, y, 0);
    this._scale.set(width, height, 1);
    this._matrix.compose(this._position, new THREE.Quaternion(), this._scale);
    this.mesh.setMatrixAt(index, this._matrix);
  }
}
