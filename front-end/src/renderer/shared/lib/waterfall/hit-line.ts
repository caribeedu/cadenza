import * as THREE from "three";

import {
  visualThemeConfig,
  type WaterfallTheme,
} from "./visual-theme";

const HALF_W = 5000;

const GLOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
varying vec2 vUv;
uniform vec3 uColor;
uniform float uOpacity;
uniform float uFadePower;
void main() {
  float dist = abs(vUv.y - 0.5) * 2.0;
  float feather = pow(max(0.0, 1.0 - dist), uFadePower);
  gl_FragColor = vec4(uColor, feather * uOpacity);
}
`;

/**
 * A bright core plus wide additive band so the play line reads through bloom.
 */
export function createHitLine(
  theme: WaterfallTheme = "lava-stage",
): THREE.Group {
  const line = visualThemeConfig(theme).hitLine;
  const g = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, line.glowThickness),
    new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fragmentShader: GLOW_FRAG,
      transparent: true,
      uniforms: {
        uColor: { value: new THREE.Color(line.glow) },
        uFadePower: { value: line.glowFadePower },
        uOpacity: { value: line.glowOpacity },
      },
      vertexShader: GLOW_VERT,
    }),
  );
  glow.renderOrder = 0;
  g.add(glow);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, line.coreThickness),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(line.core),
      depthTest: false,
      depthWrite: false,
    }),
  );
  core.position.z = 0.02;
  core.renderOrder = 1;
  g.add(core);

  return g;
}
