// @vitest-environment jsdom
import { render } from "solid-js/web";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mockInvoke } from "../../test/setup";
import { flushStore } from "../../test/flush-store";
import { AppProvider } from "../AppProvider";
import { PlayerScreen } from "./PlayerScreen";

beforeAll(() => {
  class MockResizeObserver {
    observe = vi.fn();
    disconnect = vi.fn();
    unobserve = vi.fn();
  }
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
});

describe("PlayerScreen", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    mockInvoke.mockImplementation(async (cmd: string) => {
      switch (cmd) {
        case "get_status":
          return {
            hasScore: true,
            noteCount: 2,
            durationMs: 2000,
            midiSelected: null,
            playing: false,
            paused: false,
            positionMs: 0,
            speed: 1,
            toleranceMs: 130,
          };
        case "get_timeline":
          return {
            bpm: 120,
            title: "Test Piece",
            duration_ms: 2000,
            notes: [
              { id: 1, pitch: 60, start_ms: 0, duration_ms: 500, staff: 0 },
              { id: 2, pitch: 64, start_ms: 500, duration_ms: 500, staff: 0 },
            ],
          };
        case "list_midi_ports":
          return [];
        case "check_musescore_plugin":
          return { dest: "/p", installed: true, upToDate: true };
        default:
          return null;
      }
    });
  });

  it("renders top bar with score title and play controls", async () => {
    const root = document.createElement("div");
    Object.defineProperty(root, "clientWidth", { value: 800, configurable: true });
    document.body.appendChild(root);

    render(
      () => (
        <AppProvider>
          <PlayerScreen onOpenSettings={() => undefined} />
        </AppProvider>
      ),
      root,
    );
    await flushStore();

    expect(root.textContent).toContain("Test Piece");
    expect(root.textContent).toContain("Play");
    expect(root.querySelector(".player-playfield")).not.toBeNull();
    root.remove();
  });
});
