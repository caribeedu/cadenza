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
});
