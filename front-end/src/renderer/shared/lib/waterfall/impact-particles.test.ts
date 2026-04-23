import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { WaterfallImpactParticles } from "./impact-particles";
import { visualThemeConfig } from "./visual-theme";

describe("WaterfallImpactParticles", () => {
  it("uses theme particle tint on the points material", () => {
    const p = new WaterfallImpactParticles("aurora-ice");
    const mat = p.object.material as THREE.PointsMaterial;
    const tint = visualThemeConfig("aurora-ice").particles.tint;
    expect(mat.color.getHex()).toBe(tint);
    p.dispose();
  });

  it("stashes inactive vertices off-screen so they do not stack at the origin", () => {
    const p = new WaterfallImpactParticles();
    const arr = (
      p.object.geometry.attributes.position as THREE.BufferAttribute
    ).array as Float32Array;
    expect(arr[1]).toBe(-1e5);
    p.dispose();
  });
});
