import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYBACK_SPEED, DEFAULT_TOLERANCE_MS } from "./playback-defaults";

describe("playback-defaults", () => {
  it("matches backend defaults", () => {
    expect(DEFAULT_PLAYBACK_SPEED).toBe(1);
    expect(DEFAULT_TOLERANCE_MS).toBe(130);
  });
});
