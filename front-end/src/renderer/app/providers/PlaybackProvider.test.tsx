// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { PlaybackProvider, usePlayback } from "./PlaybackProvider";

const sendMock = vi.fn();
const logMock = vi.fn();
const subscribers = new Map<string, ((msg: unknown) => void)[]>();

vi.mock("./WebSocketProvider", () => ({
  useWebSocket: () => ({
    send: sendMock,
    status: "open",
    subscribe: (type: string, handler: (msg: unknown) => void) => {
      const arr = subscribers.get(type) ?? [];
      arr.push(handler);
      subscribers.set(type, arr);
      return () => {};
    },
    subscribeDropped: () => () => {},
  }),
}));

vi.mock("./EventLogProvider", () => ({
  useEventLog: () => ({ log: logMock }),
}));

vi.mock("./ScoreConfigProvider", () => ({
  useScoreConfig: () => ({
    playbackSpeed: 1,
    setPlaybackSpeed: vi.fn(),
    setToleranceMs: vi.fn(),
    toleranceMs: 130,
  }),
}));

function Harness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof usePlayback>) => void;
}): ReactElement {
  const api = usePlayback();
  onReady(api);
  return <div />;
}

describe("PlaybackProvider seekTo", () => {
  it("sends pause then seek when currently playing", () => {
    sendMock.mockClear();
    subscribers.clear();
    let apiRef: ReturnType<typeof usePlayback> | null = null;
    render(
      <PlaybackProvider>
        <Harness onReady={(api) => (apiRef = api)} />
      </PlaybackProvider>,
    );
    if (!apiRef) throw new Error("missing api");

    const statusHandlers = subscribers.get("status") ?? [];
    act(() => {
      for (const h of statusHandlers) {
        h({
          elapsed_ms: 1200,
          midi_open: false,
          midi_port: null,
          paused: false,
          playing: true,
          score_loaded: true,
          type: "status",
        });
      }
    });
    act(() => {
      apiRef?.seekTo(3210);
    });

    expect(sendMock).toHaveBeenCalledWith({ type: "pause" });
    expect(sendMock).toHaveBeenCalledWith({ elapsed_ms: 3210, type: "seek" });
  });

  it("sends seek only when already paused", () => {
    sendMock.mockClear();
    subscribers.clear();
    let apiRef: ReturnType<typeof usePlayback> | null = null;
    render(
      <PlaybackProvider>
        <Harness onReady={(api) => (apiRef = api)} />
      </PlaybackProvider>,
    );
    if (!apiRef) throw new Error("missing api");

    const statusHandlers = subscribers.get("status") ?? [];
    act(() => {
      for (const h of statusHandlers) {
        h({
          elapsed_ms: 800,
          midi_open: false,
          midi_port: null,
          paused: true,
          playing: false,
          score_loaded: true,
          type: "status",
        });
      }
    });
    act(() => {
      apiRef?.seekTo(2100);
    });
    expect(sendMock).not.toHaveBeenCalledWith({ type: "pause" });
    expect(sendMock).toHaveBeenCalledWith({ elapsed_ms: 2100, type: "seek" });
  });
});
