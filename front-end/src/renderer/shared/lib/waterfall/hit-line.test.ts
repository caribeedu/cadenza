import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { createHitLine } from "./hit-line";
import { visualThemeConfig } from "./visual-theme";

describe("createHitLine", () => {
  it("returns a group with glow and core quads for fire theme", () => {
    const g = createHitLine("lava-stage");
    expect(g).toBeInstanceOf(THREE.Group);
    expect(g.children.length).toBe(2);
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.ShaderMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const darkLine = visualThemeConfig("lava-stage").hitLine;
    const glowColor = glowM.uniforms.uColor.value as THREE.Color;
    expect(glowColor.getHex()).toBe(darkLine.glow);
    expect(glowM.uniforms.uFadePower.value).toBe(darkLine.glowFadePower);
    expect(glowM.uniforms.uOpacity.value).toBe(darkLine.glowOpacity);
    expect(glowM.transparent).toBe(true);
    expect(glowM.blending).toBe(THREE.AdditiveBlending);
    expect(coreM.color.getHex()).toBe(
      darkLine.core,
    );
  });

  it("uses hand palette for study theme", () => {
    const g = createHitLine("aurora-ice");
    const [glow, core] = g.children;
    const glowM = (glow as THREE.Mesh).material as THREE.ShaderMaterial;
    const coreM = (core as THREE.Mesh).material as THREE.MeshBasicMaterial;
    const lightLine = visualThemeConfig("aurora-ice").hitLine;
    const glowColor = glowM.uniforms.uColor.value as THREE.Color;
    expect(glowColor.getHex()).toBe(lightLine.glow);
    expect(glowM.uniforms.uFadePower.value).toBe(lightLine.glowFadePower);
    expect(glowM.uniforms.uOpacity.value).toBe(lightLine.glowOpacity);
    expect(coreM.color.getHex()).toBe(
      lightLine.core,
    );
  });
});
