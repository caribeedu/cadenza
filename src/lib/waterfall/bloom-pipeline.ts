import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import type { WaterfallTheme } from "./theme";

export interface WaterfallBloomPipeline {
  readonly composer: EffectComposer;
  dispose(): void;
  syncSize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
}

export function createWaterfallBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  theme: WaterfallTheme,
): WaterfallBloomPipeline {
  const bloom = theme.bloom;
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomRes = new THREE.Vector2(256, 256);
  const bloomPass = new UnrealBloomPass(
    bloomRes,
    bloom.strength,
    bloom.radius,
    bloom.threshold,
  );
  const tint = new THREE.Color(bloom.tint);
  if ("bloomTintColors" in bloomPass) {
    const tintMips = (
      bloomPass as unknown as { bloomTintColors?: THREE.Vector3[] }
    ).bloomTintColors;
    if (Array.isArray(tintMips)) {
      const scales = [1.0, 0.82, 0.68, 0.56, 0.46];
      for (const [idx, vec] of tintMips.entries()) {
        const s = scales[idx] ?? 0.42;
        vec.set(tint.r * s, tint.g * s, tint.b * s);
      }
    }
  }
  bloomPass.strength = bloom.strength;
  bloomPass.radius = bloom.radius;
  bloomPass.threshold = bloom.threshold;
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  return {
    composer,
    syncSize(cssWidth, cssHeight, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(cssWidth, cssHeight);
      const s = bloom.resolutionScale;
      const effW = Math.max(1, Math.round(cssWidth * pixelRatio * s));
      const effH = Math.max(1, Math.round(cssHeight * pixelRatio * s));
      bloomPass.setSize(effW, effH);
    },
    dispose() {
      bloomPass.dispose();
      composer.dispose();
    },
  };
}
