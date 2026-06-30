// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeEach, describe, expect, it } from "vitest";
import { mockInvoke, defaultPluginStatus } from "../../test/setup";
import { flushStore } from "../../test/flush-store";
import { AppProvider } from "../AppProvider";
import { HomeScreen } from "./HomeScreen";

describe("HomeScreen", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "get_status":
          return {
            hasScore: false,
            noteCount: 0,
            durationMs: 0,
            midiSelected: "CASIO USB-MIDI",
            playing: false,
            paused: false,
            positionMs: 0,
            speed: 1,
            toleranceMs: 130,
          };
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
  });

  it("renders theme cards and continue button", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    render(
      () => (
        <AppProvider>
          <HomeScreen onContinue={() => undefined} />
        </AppProvider>
      ),
      root,
    );

    await flushStore();

    expect(root.textContent).toContain("Cadenza");
    expect(root.textContent).toContain("Lava stage");
    expect(root.querySelectorAll(".theme-card").length).toBe(2);
    expect(root.querySelector(".home-continue")).not.toBeNull();
    root.remove();
  });

  it("shows Connected without device name when MIDI selected", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <HomeScreen onContinue={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    expect(root.textContent).toContain("Connected");
    expect(root.textContent).not.toContain("Connected ·");
    root.remove();
  });

  it("shows install button when plugin not installed", async () => {
    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <HomeScreen onContinue={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    expect(root.textContent).toContain("Install plugin");
    root.remove();
  });

  it("shows plugin installed chip when plugin is up to date", async () => {
    mockInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === "check_musescore_plugin") {
        return { dest: "/plugins/Cadenza.qml", installed: true, upToDate: true };
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
      if (cmd === "get_timeline") return null;
      return null;
    });

    const root = document.createElement("div");
    render(
      () => (
        <AppProvider>
          <HomeScreen onContinue={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();
    expect(root.textContent).toContain("Plugin installed");
    expect(root.textContent).toContain("Cadenza Sender");
    expect(root.textContent).not.toContain("Install plugin");
    root.remove();
  });
});
