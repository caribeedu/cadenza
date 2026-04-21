// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRender = vi.fn();
const mockSetAnimationLoop = vi.fn();
const mockDispose = vi.fn();

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  },
);

vi.mock("three", async (importOriginal) => {
  const THREE = await importOriginal<typeof import("three")>();
  return {
    ...THREE,
    WebGLRenderer: vi.fn().mockImplementation(() => ({
      domElement: document.createElement("canvas"),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      setAnimationLoop: mockSetAnimationLoop,
      render: mockRender,
      dispose: mockDispose,
    })),
  };
});

import { WaterfallRenderer } from "./renderer";

describe("WaterfallRenderer", () => {
  const lane = {
    laneCenterPx: (pitch: number) => pitch * 4,
    laneWidthPx: () => 40,
  };

  function makeCanvas(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    Object.defineProperty(c, "clientWidth", { value: 800 });
    Object.defineProperty(c, "clientHeight", { value: 600 });
    return c;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when lane geometry is missing", () => {
    expect(() => new WaterfallRenderer(makeCanvas(), null as never)).toThrow(
      "lane-geometry",
    );
  });

  it("destroy stops the animation loop and disposes the WebGL renderer", () => {
    const r = new WaterfallRenderer(makeCanvas(), lane);
    r.destroy();
    expect(mockSetAnimationLoop).toHaveBeenCalledWith(null);
    expect(mockDispose).toHaveBeenCalled();
  });

  it("delegates play / pause / speed to the virtual playhead", () => {
    const r = new WaterfallRenderer(makeCanvas(), lane, { playbackSpeed: 2 });
    expect(r.playbackSpeed).toBe(2);
    expect(r.isPaused).toBe(false);

    r.start();
    r.pause();
    expect(r.isPaused).toBe(true);
    r.resume();
    expect(r.isPaused).toBe(false);

    r.setPlaybackSpeed(0.5, 100);
    expect(r.playbackSpeed).toBe(0.5);
    expect(r.pausedElapsedMs).toBeNull();
  });

  it("setLaneGeometry is a no-op when the argument is nullish", () => {
    const r = new WaterfallRenderer(makeCanvas(), lane);
    expect(() => r.setLaneGeometry(null)).not.toThrow();
    expect(() => r.setLaneGeometry(undefined)).not.toThrow();
  });

  it("setScore clears the playhead via stop", () => {
    const r = new WaterfallRenderer(makeCanvas(), lane);
    r.start();
    expect(r.startTimestamp).not.toBeNull();
    r.setScore({ bpm: 120, duration_ms: 0, notes: [] });
    expect(r.startTimestamp).toBeNull();
    expect(r.pausedElapsedMs).toBeNull();
  });
});
