import * as THREE from "three";
import type { WaterfallTheme } from "./theme";

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

export function createHitLine(theme: WaterfallTheme): THREE.Group {
  const line = theme.hitLine;
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
      color: line.core,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
    }),
  );
  core.renderOrder = 1;
  g.add(core);

  return g;
}

export function applyHitLineTheme(group: THREE.Group, theme: WaterfallTheme): void {
  const line = theme.hitLine;
  const glow = group.children[0] as THREE.Mesh;
  const core = group.children[1] as THREE.Mesh;
  const glowMat = glow.material as THREE.ShaderMaterial;
  (glowMat.uniforms.uColor.value as THREE.Color).set(line.glow);
  glowMat.uniforms.uFadePower.value = line.glowFadePower;
  glowMat.uniforms.uOpacity.value = line.glowOpacity;
  glow.geometry.dispose();
  glow.geometry = new THREE.PlaneGeometry(HALF_W * 2, line.glowThickness);
  (core.material as THREE.MeshBasicMaterial).color.set(line.core);
  core.geometry.dispose();
  core.geometry = new THREE.PlaneGeometry(HALF_W * 2, line.coreThickness);
}
