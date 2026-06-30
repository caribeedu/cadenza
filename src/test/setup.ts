import { vi } from "vitest";

const { mockInvoke, defaultAppStatus, defaultPluginStatus } = vi.hoisted(() => {
  const defaultAppStatus = {
    hasScore: false,
    noteCount: 0,
    durationMs: 0,
    midiSelected: null as string | null,
    playing: false,
    paused: false,
    positionMs: 0,
    speed: 1,
    toleranceMs: 130,
  };

  const defaultPluginStatus = {
    dest: "/plugins/Cadenza.qml",
    installed: false,
    upToDate: false,
  };

  const mockInvoke = vi.fn(async (cmd: string, _args?: unknown) => {
    switch (cmd) {
      case "get_status":
        return { ...defaultAppStatus };
      case "get_timeline":
        return null;
      case "list_midi_ports":
        return ["CASIO USB-MIDI"];
      case "check_musescore_plugin":
        return { ...defaultPluginStatus };
      default:
        return null;
    }
  });

  return { mockInvoke, defaultAppStatus, defaultPluginStatus };
});

export { mockInvoke, defaultAppStatus, defaultPluginStatus };

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => undefined)),
}));
