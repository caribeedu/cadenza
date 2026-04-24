import { describe, expect, it } from "vitest";

import { buildTimelineBins, msToRatio, ratioToMs } from "./timeline-preview";

describe("timeline-preview helpers", () => {
  it("maps ms to ratio and back with clamping", () => {
    expect(msToRatio(500, 1000)).toBe(0.5);
    expect(msToRatio(-100, 1000)).toBe(0);
    expect(msToRatio(1200, 1000)).toBe(1);
    expect(ratioToMs(0.25, 1000)).toBe(250);
    expect(ratioToMs(2, 1000)).toBe(1000);
  });

  it("builds non-empty bins with normalized densities", () => {
    const bins = buildTimelineBins(
      [
        { duration_ms: 100, id: 1, pitch: 60, start_ms: 0 },
        { duration_ms: 100, id: 2, pitch: 62, start_ms: 500 },
        { duration_ms: 100, id: 3, pitch: 64, start_ms: 500 },
      ],
      1000,
      8,
    );
    expect(bins).toHaveLength(8);
    expect(Math.max(...bins.map((b) => b.density))).toBe(1);
    expect(bins.some((b) => b.density > 0)).toBe(true);
  });
});
