// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./bloom-pipeline", () => ({
  createWaterfallBloomPipeline: () => ({
    dispose: vi.fn(),
    syncSize: vi.fn(),
    composer: { render: vi.fn() },
  }),
}));

vi.mock("three", async (importOriginal) => {
  const THREE = await importOriginal<typeof import("three")>();
  class MockWebGLRenderer {
    domElement = document.createElement("canvas");
    outputColorSpace = THREE.SRGBColorSpace;
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setAnimationLoop = vi.fn();
    dispose = vi.fn();
  }
  return { ...THREE, WebGLRenderer: MockWebGLRenderer };
});

import { computeKeyboardLayout } from "../piano-layout";
import { WaterfallRenderer } from "./renderer";

beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

describe("WaterfallRenderer lifecycle", () => {
  it("constructs, accepts a score, and destroy cleans up", () => {
    const canvas = document.createElement("canvas");
    Object.defineProperty(canvas, "clientWidth", { value: 720, configurable: true });
    Object.defineProperty(canvas, "clientHeight", { value: 400, configurable: true });

    const laneGeometry = computeKeyboardLayout({ high: 96, low: 36, totalWidthPx: 720 });
    const renderer = new WaterfallRenderer(canvas, laneGeometry);

    expect(renderer.noteMeshes.size).toBe(0);

    renderer.setScore({ bpm: 120, duration_ms: 0, notes: [] });
    expect(renderer.noteMeshes.size).toBe(0);

    expect(() => renderer.destroy()).not.toThrow();
    expect(renderer.renderer.dispose).toHaveBeenCalled();
  });
});
