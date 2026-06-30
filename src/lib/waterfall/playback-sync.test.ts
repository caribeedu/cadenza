import { describe, expect, it } from "vitest";
import { resolvePlaybackSyncAction } from "./playback-sync";

describe("resolvePlaybackSyncAction", () => {
  it("stops when leaving pause via stop (not resume)", () => {
    expect(
      resolvePlaybackSyncAction({
        serverPlaying: false,
        serverPaused: false,
        wasPlaying: false,
        wasPaused: true,
        serverElapsedMs: 0,
      }),
    ).toEqual({ type: "stop" });
  });

  it("resumes when unpausing into playing", () => {
    expect(
      resolvePlaybackSyncAction({
        serverPlaying: true,
        serverPaused: false,
        wasPlaying: false,
        wasPaused: true,
        serverElapsedMs: 1200,
      }),
    ).toEqual({ type: "resume" });
  });

  it("starts from server elapsed when playing from idle", () => {
    expect(
      resolvePlaybackSyncAction({
        serverPlaying: true,
        serverPaused: false,
        wasPlaying: false,
        wasPaused: false,
        serverElapsedMs: 0,
      }),
    ).toEqual({ type: "start", atMs: 0 });
  });
});
