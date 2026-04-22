import * as THREE from "three";

import { FEEDBACK } from "./visual-theme";
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
  float f = fbm(uv * vec2(4.0, 7.0) + vec2(0.0, uTime * 0.6));
  float n = 0.42 + 0.58 * f;
  vec3 base = mix(uColorLow, uColorHigh, uv.y) * n;
  vec3 c = base;
  if (uStatus == 1) c = mix(base, uGood, 0.88);
  else if (uStatus == 2) c = mix(base, uBad, 0.9);
  gl_FragColor = vec4(c, 1.0);
}
`;

export function createLavaBarMaterial(pitch: number): THREE.ShaderMaterial {
  const g = fireBarGradient(pitch);
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: FRAG,
    uniforms: {
      uBad: { value: new THREE.Vector3() },
      uColorHigh: { value: g.high },
      uColorLow: { value: g.low },
      uGood: { value: new THREE.Vector3() },
      uStatus: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: VERT,
  });
}

export function initLavaBarFeedbackUniforms(mat: THREE.ShaderMaterial): void {
  mat.uniforms.uGood.value.set(FEEDBACK.good.r, FEEDBACK.good.g, FEEDBACK.good.b);
  mat.uniforms.uBad.value.set(FEEDBACK.bad.r, FEEDBACK.bad.g, FEEDBACK.bad.b);
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
