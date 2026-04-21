import { describe, expect, it } from "vitest";

import { midiFromName } from "./pitch-name";

describe("midiFromName", () => {
  it("maps diatonic letter names to pitch classes (C=0)", () => {
    expect(midiFromName("C")).toBe(0);
    expect(midiFromName("D")).toBe(2);
    expect(midiFromName("B")).toBe(11);
  });

  it("returns 0 for unknown symbols", () => {
    expect(midiFromName("?")).toBe(0);
  });
});
