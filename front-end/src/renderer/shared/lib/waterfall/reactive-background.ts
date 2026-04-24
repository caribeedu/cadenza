import type { WaterfallVisualTheme } from "@app/theme/theme";

import * as THREE from "three";

import type { NotePlayed } from "../../types/score";
import type { MoodUniformSnapshot } from "./mood-state";

import { MoodState } from "./mood-state";

/**
 * Uniforms: uTime, uColorDeep/Mid/Glow, uEnergy, uWarp, uHueShift, uSpread,
 * uTension, uBass/Mid/Treble, uRippleUv, uRippleStrength — see MoodUniformSnapshot.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uColorDeep;
uniform vec3 uColorMid;
uniform vec3 uColorGlow;
uniform float uEnergy;
uniform float uWarp;
uniform float uHueShift;
uniform float uSpread;
uniform float uTension;
uniform float uBass;
uniform float uMid;
uniform float uTreble;
uniform vec2 uRippleUv;
uniform float uRippleStrength;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.1;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  float reg = uBass * 0.4 + uMid * 0.35 + uTreble * 0.25;
  // Keep warble amplitude; avoid large uSpread so held keys do not "pump" the whole field
  float warpAmt = (0.12 + uWarp * 0.55 + uSpread * 0.08) * (0.85 + reg * 0.35);
  // Phase only (not DC uv offset) — big hue/treble coeffs used to slide the entire pattern
  vec2 wob = vec2(
    sin(uTime * 0.31 + uv.y * 6.283 + uHueShift * 2.2),
    cos(uTime * 0.27 + uv.x * 6.283 + uTreble * 1.1)
  ) * warpAmt;
  uv += wob * 0.04;

  float n = fbm(uv * (2.2 + uEnergy * 1.8) + uTime * 0.08);
  float n2 = fbm(uv * (4.0 + uSpread * 2.0) - uTime * 0.05);

  float gy = uv.y;
  // No static vertical shift from register balance at rest; only when there is recent energy
  gy += (uTreble - uBass) * 0.04 * uEnergy;
  float grad = smoothstep(0.0, 0.55, gy) * (1.0 - smoothstep(0.45, 1.0, gy));
  vec3 base = mix(uColorDeep, uColorMid, grad * 0.85 + n * 0.22);
  base = mix(base, uColorGlow, n2 * (0.18 + uEnergy * 0.35));
  // Shimmer on-palette only (avoids fixed RGB axes that read green/purple on warm themes)
  base += uColorGlow * (n2 - 0.5) * (0.06 + uEnergy * 0.1);
  base *= 1.0 - uTension * 0.12;

  vec2 rd = vUv - uRippleUv;
  float dist = length(rd);
  float ring = sin(dist * 72.0 - uTime * 7.5) * exp(-dist * 4.5);
  base += uColorGlow * ring * uRippleStrength * (0.11 + uEnergy * 0.12);

  float vign = smoothstep(1.15, 0.35, length(vUv - 0.5) * 1.15);
  base *= 0.88 + vign * 0.12;

  gl_FragColor = vec4(base, 1.0);
}
`;

function themeGradientColors(theme: WaterfallVisualTheme): {
  deep: THREE.Color;
  glow: THREE.Color;
  mid: THREE.Color;
} {
  return {
    deep: new THREE.Color(theme.backdrop.deep),
    mid: new THREE.Color(theme.backdrop.mid),
    glow: new THREE.Color(theme.backdrop.glow),
  };
}

export class WaterfallReactiveBackground {
  readonly mood: MoodState;
  readonly mesh: THREE.Mesh;
  private readonly _mat: THREE.ShaderMaterial;
  private _accTime = 0;

  constructor(theme: WaterfallVisualTheme) {
    this.mood = new MoodState();
    const { deep, mid, glow } = themeGradientColors(theme);
    this._mat = new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      fragmentShader: FRAG,
      fog: false,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: deep },
        uColorMid: { value: mid },
        uColorGlow: { value: glow },
        uEnergy: { value: 0 },
        uWarp: { value: 0 },
        uHueShift: { value: 0.5 },
        uSpread: { value: 0 },
        uTension: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uRippleUv: { value: new THREE.Vector2(0.5, 0.72) },
        uRippleStrength: { value: 0 },
      },
      vertexShader: VERT,
    });
    const geom = new THREE.PlaneGeometry(1, 1);
    this.mesh = new THREE.Mesh(geom, this._mat);
    this.mesh.renderOrder = -500;
    this.mesh.frustumCulled = false;
  }

  applyTheme(theme: WaterfallVisualTheme): void {
    const { deep, mid, glow } = themeGradientColors(theme);
    this._mat.uniforms.uColorDeep.value.copy(deep);
    this._mat.uniforms.uColorMid.value.copy(mid);
    this._mat.uniforms.uColorGlow.value.copy(glow);
  }

  /**
   * Fit the plane to the orthographic waterfall frustum (world px).
   */
  setFrustum(
    worldWidthPx: number,
    worldHeightPx: number,
    centerWorldY: number,
    z: number,
  ): void {
    const w = Math.max(1, worldWidthPx);
    const h = Math.max(1, worldHeightPx);
    this.mesh.scale.set(w * 1.02, h * 1.02, 1);
    this.mesh.position.set(0, centerWorldY, z);
  }

  onNotePlayed(
    note: NotePlayed,
    rippleU: number,
    rippleV: number,
  ): void {
    this.mood.onNotePlayed(note, rippleU, rippleV);
  }

  setHeldKeyCount(n: number): void {
    this.mood.setHeldKeyCount(n);
  }

  tick(dt: number): MoodUniformSnapshot {
    this._accTime += dt;
    const snap = this.mood.tick(dt);
    const u = this._mat.uniforms;
    u.uTime.value = this._accTime;
    u.uEnergy.value = snap.energy;
    u.uWarp.value = snap.warp;
    u.uHueShift.value = snap.hueShift;
    u.uSpread.value = snap.spread;
    u.uTension.value = snap.tension;
    u.uBass.value = snap.bass;
    u.uMid.value = snap.mid;
    u.uTreble.value = snap.treble;
    u.uRippleUv.value.set(snap.rippleU, snap.rippleV);
    u.uRippleStrength.value = snap.rippleStrength;
    return snap;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this._mat.dispose();
  }
}
