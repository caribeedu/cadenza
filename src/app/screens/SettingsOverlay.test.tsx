// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockInvoke } from "../../test/setup";
import { flushStore } from "../../test/flush-store";
import { AppProvider } from "../AppProvider";
import { SettingsOverlay } from "./SettingsOverlay";

describe("SettingsOverlay", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "get_status":
          return {
            hasScore: true,
            noteCount: 1,
            durationMs: 1000,
            midiSelected: null,
            playing: false,
            paused: false,
            positionMs: 0,
            speed: 1.25,
            toleranceMs: 150,
          };
        case "get_timeline":
          return { bpm: 120, duration_ms: 1000, notes: [] };
        case "list_midi_ports":
          return [];
        case "check_musescore_plugin":
          return { dest: "/p", installed: true, upToDate: true };
        default:
          return null;
      }
    });
  });

  it("renders settings panel with speed and tolerance", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <SettingsOverlay onClose={() => undefined} onBackToMenu={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await Promise.resolve();
    expect(root.textContent).toContain("Settings");
    expect(root.textContent).toContain("Speed");
    expect(root.textContent).toContain("1.25×");
    expect(root.textContent).toContain("Back to menu");
    root.remove();
  });

  it("renders dismissible backdrop", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <SettingsOverlay onClose={() => undefined} onBackToMenu={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    expect(root.querySelector(".overlay-backdrop")).not.toBeNull();
    root.remove();
  });
});
