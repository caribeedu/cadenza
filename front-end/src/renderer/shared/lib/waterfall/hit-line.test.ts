import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createHitLine } from "./hit-line";

describe("createHitLine", () => {
  it("returns a horizontal world-space line through y=0 from x=-5000 to x=5000", () => {
    const line = createHitLine();
    expect(line).toBeInstanceOf(THREE.Line);

    const pos = line.geometry.attributes.position;
    expect(pos.count).toBe(2);
    expect(pos.getX(0)).toBe(-5000);
    expect(pos.getY(0)).toBe(0);
    expect(pos.getZ(0)).toBe(0);
    expect(pos.getX(1)).toBe(5000);
    expect(pos.getY(1)).toBe(0);
    expect(pos.getZ(1)).toBe(0);
  });

  it("uses a white line basic material", () => {
    const line = createHitLine();
    const mat = line.material as THREE.LineBasicMaterial;
    expect(mat.color.getHex()).toBe(0xffffff);
  });
});
