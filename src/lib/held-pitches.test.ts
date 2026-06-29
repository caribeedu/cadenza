import { describe, expect, it } from "vitest";

import { addHeldPitch, removeHeldPitch } from "./held-pitches";

describe("held-pitches", () => {
  it("adds a pitch once and keeps sorted order", () => {
    expect(addHeldPitch([60], 64)).toEqual([60, 64]);
    expect(addHeldPitch([60, 64], 60)).toEqual([60, 64]);
  });

  it("removes a held pitch", () => {
    expect(removeHeldPitch([60, 64], 60)).toEqual([64]);
    expect(removeHeldPitch([64], 60)).toEqual([64]);
  });
});
