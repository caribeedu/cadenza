import * as THREE from "three";

import {
  feedbackForTheme,
  visualThemeConfig,
  type WaterfallTheme,
} from "./visual-theme";
import { fireBarGradient } from "./fire-pending-color";

export type LavaBarStatus = "bad" | "good" | "pending";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColorLow;
uniform vec3 uColorHigh;
uniform vec3 uGood;
uniform vec3 uBad;
uniform float uTime;
uniform int uStatus;
uniform vec2 uNoiseUvScale;
uniform float uNoiseTimeScale;
uniform float uNoiseValueBase;
uniform float uNoiseValueAmp;
uniform float uMixGood;
uniform float uMixBad;
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
  vec2 uv = vUv;
  float f = fbm(uv * uNoiseUvScale + vec2(0.0, uTime * uNoiseTimeScale));
  float n = uNoiseValueBase + uNoiseValueAmp * f;
  vec3 base = mix(uColorLow, uColorHigh, uv.y) * n;
  vec3 c = base;
  if (uStatus == 1) c = mix(base, uGood, uMixGood);
  else if (uStatus == 2) c = mix(base, uBad, uMixBad);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createLavaBarMaterial(
  pitch: number,
  theme: WaterfallTheme,
): THREE.ShaderMaterial {
  const g = fireBarGradient(pitch);
  const d = visualThemeConfig(theme).lavaAppearance;
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: FRAG,
    uniforms: {
      uBad: { value: new THREE.Vector3() },
      uColorHigh: { value: g.high },
      uColorLow: { value: g.low },
      uGood: { value: new THREE.Vector3() },
      uMixBad: { value: d.mixBad },
      uMixGood: { value: d.mixGood },
      uNoiseTimeScale: { value: d.noiseTimeScale },
      uNoiseUvScale: {
        value: new THREE.Vector2(d.noiseUvScaleX, d.noiseUvScaleY),
      },
      uNoiseValueAmp: { value: d.noiseValueAmp },
      uNoiseValueBase: { value: d.noiseValueBase },
      uStatus: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
  });
}

export function initLavaBarFeedbackUniforms(
  mat: THREE.ShaderMaterial,
  theme: WaterfallTheme = "cadenza-dark",
): void {
  const good = feedbackForTheme(theme, "good");
  const bad = feedbackForTheme(theme, "bad");
  mat.uniforms.uGood.value.set(good.r, good.g, good.b);
  mat.uniforms.uBad.value.set(bad.r, bad.g, bad.b);

  const lava = visualThemeConfig(theme).lavaAppearance;
  mat.uniforms.uMixGood.value = lava.mixGood;
  mat.uniforms.uMixBad.value = lava.mixBad;
  mat.uniforms.uNoiseTimeScale.value = lava.noiseTimeScale;
  (mat.uniforms.uNoiseUvScale.value as THREE.Vector2).set(
    lava.noiseUvScaleX,
    lava.noiseUvScaleY,
  );
  mat.uniforms.uNoiseValueAmp.value = lava.noiseValueAmp;
  mat.uniforms.uNoiseValueBase.value = lava.noiseValueBase;
}

export function setLavaBarStatus(
  mat: THREE.ShaderMaterial,
  status: LavaBarStatus,
): void {
  if (status === "pending") {
    mat.uniforms.uStatus.value = 0;
  } else if (status === "good") {
    mat.uniforms.uStatus.value = 1;
  } else {
    mat.uniforms.uStatus.value = 2;
  }
}

export function setLavaBarTime(mat: THREE.ShaderMaterial, t: number): void {
  mat.uniforms.uTime.value = t;
}
