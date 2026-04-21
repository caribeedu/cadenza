import * as THREE from "three";

const COLOUR_LINE = new THREE.Color(0xffffff);

export function createHitLine(): THREE.Line {
  const mat = new THREE.LineBasicMaterial({ color: COLOUR_LINE });
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-5000, 0, 0),
    new THREE.Vector3(5000, 0, 0),
  ]);
  return new THREE.Line(geom, mat);
}
