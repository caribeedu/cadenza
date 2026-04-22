import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import { BLOOM } from "./visual-theme";

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
): WaterfallBloomPipeline {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const bloomRes = new THREE.Vector2(256, 256);
  const bloomPass = new UnrealBloomPass(
    bloomRes,
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold,
  );
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(outputPass);

  return {
    composer,
    syncSize(cssWidth, cssHeight, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(cssWidth, cssHeight);
      const s = BLOOM.resolutionScale;
      const effW = cssWidth * pixelRatio * s;
      const effH = cssHeight * pixelRatio * s;
      bloomPass.setSize(effW, effH);
    },
    dispose() {
      bloomPass.dispose();
      composer.dispose();
    },
  };
}
