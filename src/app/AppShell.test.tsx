// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeEach, describe, expect, it } from "vitest";
import { mockInvoke } from "../test/setup";
import { AppProvider } from "./AppProvider";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "get_status":
          return {
            hasScore: false,
            noteCount: 0,
            durationMs: 0,
            midiSelected: null,
            playing: false,
            paused: false,
            positionMs: 0,
            speed: 1,
            toleranceMs: 130,
          };
        case "get_timeline":
          return null;
        case "list_midi_ports":
          return [];
        case "check_musescore_plugin":
          return { dest: "/p", installed: false, upToDate: false };
        default:
          return null;
      }
    });
  });

  it("starts on home screen", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <AppShell />
        </AppProvider>
      ),
      root,
    );
    await Promise.resolve();
    expect(root.textContent).toContain("Cadenza");
    expect(root.querySelector(".home-continue")).not.toBeNull();
    expect(root.querySelector(".player-screen")).toBeNull();
    root.remove();
  });
});
