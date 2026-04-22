import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createHitLine } from "./hit-line";
import { visualThemeConfig } from "./visual-theme";

describe("createHitLine", () => {
  it("returns a group with glow and core quads for fire theme", () => {
    const g = createHitLine("cadenza-dark");
    expect(g).toBeInstanceOf(THREE.Group);
    expect(g.children.length).toBe(2);
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const darkLine = visualThemeConfig("cadenza-dark").hitLine;
    expect(glowM.color.getHex()).toBe(
      darkLine.glow,
    );
    expect(glowM.opacity).toBe(darkLine.glowOpacity);
    expect(glowM.transparent).toBe(true);
    expect(glowM.blending).toBe(THREE.AdditiveBlending);
    expect(coreM.color.getHex()).toBe(
      darkLine.core,
    );
  });

  it("uses hand palette for study theme", () => {
    const g = createHitLine("cadenza-light");
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(glowM.color.getHex()).toBe(
      visualThemeConfig("cadenza-light").hitLine.glow,
    );
    expect(coreM.color.getHex()).toBe(
      visualThemeConfig("cadenza-light").hitLine.core,
    );
  });
});
