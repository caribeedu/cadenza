// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../lib/waterfall/bloom-pipeline", () => ({
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
    getPixelRatio = vi.fn(() => 1);
    setSize = vi.fn();
    setAnimationLoop = vi.fn();
    dispose = vi.fn();
  }
  return { ...THREE, WebGLRenderer: MockWebGLRenderer };
});

import { render } from "solid-js/web";
import { computeKeyboardLayout } from "../lib/piano-layout";
import { HIGHEST_MIDI, LOWEST_MIDI } from "../lib/timeline";
import { Waterfall } from "./Waterfall";

beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

describe("Waterfall", () => {
  it("renders canvas element", () => {
    const laneGeometry = computeKeyboardLayout({
      low: LOWEST_MIDI,
      high: HIGHEST_MIDI,
      totalWidthPx: 720,
    });
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Waterfall
          laneGeometry={laneGeometry}
          score={{ bpm: 120, duration_ms: 1000, notes: [] }}
          serverElapsedMs={0}
          serverPlaying={false}
          serverPaused={false}
          serverPlaybackSpeed={1}
          latestNotePlayed={null}
          sessionRestartGeneration={0}
          seekGeneration={0}
          heldMidiPitches={[]}
          waterfallThemeId="lava-stage"
        />
      ),
      host,
    );
    expect(host.querySelector("canvas.waterfall-canvas")).not.toBeNull();
    dispose();
  });
});
