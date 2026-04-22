import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createHitLine } from "./hit-line";
import { HIT_LINE_FIRE, HIT_LINE_HAND } from "./visual-theme";

describe("createHitLine", () => {
  it("returns a group with glow and core quads for fire theme", () => {
    const g = createHitLine("fire");
    expect(g).toBeInstanceOf(THREE.Group);
    expect(g.children.length).toBe(2);
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(glowM.color.getHex()).toBe(HIT_LINE_FIRE.glow);
    expect(glowM.transparent).toBe(true);
    expect(glowM.blending).toBe(THREE.AdditiveBlending);
    expect(coreM.color.getHex()).toBe(HIT_LINE_FIRE.core);
  });

  it("uses hand palette for study theme", () => {
    const g = createHitLine("hand");
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(glowM.color.getHex()).toBe(HIT_LINE_HAND.glow);
    expect(coreM.color.getHex()).toBe(HIT_LINE_HAND.core);
  });
});
