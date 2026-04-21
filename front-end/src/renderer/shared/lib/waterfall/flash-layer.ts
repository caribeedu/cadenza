import * as THREE from "three";

import type { LaneGeometry } from "../../types/geometry";

export interface FlashUserData {
  spawnedAt: number;
}

export type FlashMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> & {
  userData: FlashUserData;
};

const FLASH_DURATION_MS = 300;

/** Ephemeral lane flashes for played notes (feedback). */
export class WaterfallFlashLayer {
  readonly flashes: FlashMesh[] = [];
  readonly group = new THREE.Group();

  constructor(
    private laneGeometry: LaneGeometry,
    private readonly now: () => number = () => performance.now(),
  ) {}

  setLaneGeometry(lane: LaneGeometry): void {
    this.laneGeometry = lane;
  }

  spawn(
    pitch: number,
    color: THREE.Color,
    canvasWidthPx: number,
  ): void {
    const laneWidth = this.laneGeometry.laneWidthPx(pitch);
    const geom = new THREE.PlaneGeometry(Math.max(3, laneWidth * 1.05), 10);
    const mat = new THREE.MeshBasicMaterial({
      color: color.clone(),
      opacity: 1,
      transparent: true,
    });
    const mesh = new THREE.Mesh(geom, mat) as FlashMesh;
    mesh.position.set(
      this.laneGeometry.laneCenterPx(pitch) - canvasWidthPx / 2,
      0,
      0,
    );
    mesh.userData = { spawnedAt: this.now() };
    this.group.add(mesh);
    this.flashes.push(mesh);
  }

  tick(): void {
    const now = this.now();
    for (let i = this.flashes.length - 1; i >= 0; --i) {
      const f = this.flashes[i];
      const age = now - f.userData.spawnedAt;
      if (age >= FLASH_DURATION_MS) {
        this.group.remove(f);
        f.geometry.dispose();
        f.material.dispose();
        this.flashes.splice(i, 1);
      } else {
        f.material.opacity = 1 - age / FLASH_DURATION_MS;
      }
    }
  }
}
