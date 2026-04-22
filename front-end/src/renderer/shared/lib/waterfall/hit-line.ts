import * as THREE from "three";

import {
  visualThemeConfig,
  type WaterfallTheme,
} from "./visual-theme";

const HALF_W = 5000;

/**
 * A bright core plus wide additive band so the play line reads through bloom.
 */
export function createHitLine(
  theme: WaterfallTheme = "cadenza-dark",
): THREE.Group {
  const line = visualThemeConfig(theme).hitLine;
  const g = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, line.glowThickness),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(line.glow),
      depthTest: false,
      depthWrite: false,
      opacity: line.glowOpacity,
      transparent: true,
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
