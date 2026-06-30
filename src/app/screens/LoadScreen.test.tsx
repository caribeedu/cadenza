// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "solid-js/web";
import { mockInvoke, defaultPluginStatus } from "../../test/setup";
import { flushStore } from "../../test/flush-store";
import { AppProvider } from "../AppProvider";
import { LoadScreen } from "./LoadScreen";

describe("LoadScreen", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "check_musescore_plugin":
          return { ...defaultPluginStatus };
        case "list_midi_ports":
          return [];
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
        default:
          return null;
      }
    });
  });

  it("renders load steps and listening indicator", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <LoadScreen onBack={() => undefined} onGoHome={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await Promise.resolve();
    expect(root.textContent).toContain("Load your music");
    expect(root.textContent).toContain("Listening on 127.0.0.1:8765");
    expect(root.querySelector(".iso-pipeline")).not.toBeNull();
    root.remove();
  });

  it("hides install hint when plugin is installed", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_musescore_plugin") {
        return { dest: "/p", installed: true, upToDate: true };
      }
      if (cmd === "list_midi_ports") return [];
      if (cmd === "get_status") {
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
      }
      return null;
    });

    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <LoadScreen onBack={() => undefined} onGoHome={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    expect(root.textContent).not.toContain("Install from Home");
    root.remove();
  });

  it("renders back button in header", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <LoadScreen onBack={() => undefined} onGoHome={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    const back = Array.from(root.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Back"),
    );
    expect(back).not.toBeNull();
    root.remove();
  });
});
