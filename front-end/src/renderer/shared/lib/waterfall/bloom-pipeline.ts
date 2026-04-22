import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import type { WaterfallVisualTheme } from "@app/theme/ui-theme";

export interface WaterfallBloomPipeline {
  readonly composer: EffectComposer;
  /**
   * Match composer + renderer to the CSS size and DPR, then downscale the
   * internal bloom buffer by {@link BLOOM.resolutionScale} for cost.
   */
  syncSize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  dispose(): void;
}

/**
 * ``RenderPass`` → ``UnrealBloomPass`` → ``OutputPass`` (sRGB / renderer output
 * settings) per three.js post-processing practice for r16x.
 */
export function createWaterfallBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  theme: WaterfallVisualTheme,
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
