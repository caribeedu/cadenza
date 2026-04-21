import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { WaterfallFlashLayer } from "./flash-layer";

describe("WaterfallFlashLayer", () => {
  const lane = {
    laneCenterPx: (pitch: number) => pitch * 2,
    laneWidthPx: (pitch: number) => 20 + pitch,
  };

  it("spawn adds a flash mesh parented to the group with lane-based x and recorded time", () => {
    let t = 10_000;
    const layer = new WaterfallFlashLayer(lane, () => t);
    const color = new THREE.Color(0xff0000);
    layer.spawn(5, color, 800);

    expect(layer.flashes).toHaveLength(1);
    expect(layer.group.children).toHaveLength(1);
    const mesh = layer.flashes[0];
    expect(mesh.userData.spawnedAt).toBe(10_000);
    // laneCenterPx(5) - w/2 = 10 - 400 = -390
    expect(mesh.position.x).toBe(-390);
    expect(mesh.position.y).toBe(0);
    expect(mesh.material.opacity).toBe(1);
  });

  it("tick fades opacity linearly toward zero over 300ms", () => {
    let t = 0;
    const layer = new WaterfallFlashLayer(lane, () => t);
    layer.spawn(0, new THREE.Color(0xffffff), 100);
    t = 100;
    layer.tick();
    expect(layer.flashes[0].material.opacity).toBeCloseTo(1 - 100 / 300, 5);
  });

  it("tick removes and disposes flashes at or after 300ms age", () => {
    let t = 0;
    const layer = new WaterfallFlashLayer(lane, () => t);
    layer.spawn(0, new THREE.Color(0xffffff), 100);
    const mesh = layer.flashes[0];
    const disposeGeom = vi.spyOn(mesh.geometry, "dispose");
    const disposeMat = vi.spyOn(mesh.material, "dispose");

    t = 299;
    layer.tick();
    expect(layer.flashes).toHaveLength(1);

    t = 300;
    layer.tick();
    expect(layer.flashes).toHaveLength(0);
    expect(layer.group.children).toHaveLength(0);
    expect(disposeGeom).toHaveBeenCalledOnce();
    expect(disposeMat).toHaveBeenCalledOnce();
  });

  it("setLaneGeometry changes spawn position for subsequent flashes", () => {
    const layer = new WaterfallFlashLayer(lane);
    layer.spawn(10, new THREE.Color(0xffffff), 1000);
    const xBefore = layer.flashes[0].position.x;

    layer.setLaneGeometry({
      laneCenterPx: () => 500,
      laneWidthPx: () => 40,
    });
    layer.spawn(10, new THREE.Color(0xffffff), 1000);
    expect(layer.flashes[1].position.x).toBe(500 - 500);
    expect(layer.flashes[1].position.x).not.toBe(xBefore);
  });
});
