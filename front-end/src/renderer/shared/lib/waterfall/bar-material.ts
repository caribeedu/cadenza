import * as THREE from "three";

import {
  EMISSIVE_BAD,
  EMISSIVE_GOOD,
  EMISSIVE_PENDING,
} from "./visual-theme";

/**
 * Slightly soft plastic: reads well under hemisphere + ambient fill, and
 * emissive gives a readable “glow” without bloom.
 */
export function createNoteBarMaterial(base: THREE.Color): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: base.clone(),
    emissive: new THREE.Color(0x000000),
    fog: false,
    metalness: 0.1,
    roughness: 0.32,
    depthTest: false,
    depthWrite: false,
  });
  setNoteBarFaceColor(mat, base, "pending");
  return mat;
}

export function setNoteBarFaceColor(
  mat: THREE.MeshStandardMaterial,
  color: THREE.Color,
  state: "pending" | "good" | "bad",
): void {
  mat.color.copy(color);
  const s =
    state === "good"
      ? EMISSIVE_GOOD
      : state === "bad"
        ? EMISSIVE_BAD
        : EMISSIVE_PENDING;
  mat.emissive.copy(color).multiplyScalar(s);
}
