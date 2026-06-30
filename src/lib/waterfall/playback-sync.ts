export type PlaybackSyncInput = {
  serverPlaying: boolean;
  serverPaused: boolean;
  wasPlaying: boolean;
  wasPaused: boolean;
  serverElapsedMs: number | null;
};

export type PlaybackSyncAction =
  | { type: "stop" }
  | { type: "resume" }
  | { type: "start"; atMs: number }
  | { type: "pause"; atMs: number }
  | { type: "none" };

export function resolvePlaybackSyncAction(input: PlaybackSyncInput): PlaybackSyncAction {
  const { serverPlaying, serverPaused, wasPlaying, wasPaused, serverElapsedMs } = input;

  if (!serverPlaying && !serverPaused && (wasPlaying || wasPaused)) {
    if (typeof serverElapsedMs === "number" && serverElapsedMs > 0) {
      return { type: "pause", atMs: serverElapsedMs };
    }
    return { type: "stop" };
  }
  if (serverPlaying && !serverPaused && wasPaused) {
    return { type: "resume" };
  }
  if (serverPlaying && !wasPlaying && !serverPaused) {
    if (typeof serverElapsedMs === "number") return { type: "start", atMs: serverElapsedMs };
    return { type: "start", atMs: 0 };
  }
  if (serverPaused && !wasPaused) {
    if (typeof serverElapsedMs === "number") return { type: "pause", atMs: serverElapsedMs };
  }
  return { type: "none" };
}
