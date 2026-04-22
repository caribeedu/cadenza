import * as THREE from "three";

import {
  HIT_LINE_FIRE,
  HIT_LINE_HAND,
  type WaterfallTheme,
} from "./visual-theme";

const HALF_W = 5000;

/**
 * A bright core plus wide additive band so the play line reads through bloom.
 */
export function createHitLine(theme: WaterfallTheme = "fire"): THREE.Group {
  const pal = theme === "hand" ? HIT_LINE_HAND : HIT_LINE_FIRE;
  const g = new THREE.Group();

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, 14),
    new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      color: new THREE.Color(pal.glow),
      depthTest: false,
      depthWrite: false,
      opacity: 0.4,
      transparent: true,
    }),
  );
  glow.renderOrder = 0;
  g.add(glow);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_W * 2, 3),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(pal.core),
      depthTest: false,
      depthWrite: false,
    }),
  );
  core.position.z = 0.02;
  core.renderOrder = 1;
  g.add(core);

  return g;
}
