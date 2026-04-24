// @vitest-environment jsdom
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TimelineScrubber } from "./TimelineScrubber";

const SCORE = {
  bpm: 120,
  duration_ms: 1000,
  notes: [
    { duration_ms: 100, id: 1, pitch: 60, start_ms: 50 },
    { duration_ms: 100, id: 2, pitch: 64, start_ms: 400 },
    { duration_ms: 100, id: 3, pitch: 67, start_ms: 800 },
  ],
  title: "Test",
};

describe("TimelineScrubber", () => {
  it("renders bins for loaded score", () => {
    const { container } = render(
      <TimelineScrubber
        onSeek={vi.fn()}
        score={SCORE}
        serverElapsedMs={200}
        serverPaused={false}
        serverPlaybackSpeed={1}
        serverPlaying={false}
      />,
    );
    expect(container.querySelectorAll(".timeline-scrubber__bin").length).toBe(96);
  });

  it("commits seek on drag end", () => {
    const onSeek = vi.fn();
    const { container } = render(
      <TimelineScrubber
        onSeek={onSeek}
        score={SCORE}
        serverElapsedMs={0}
        serverPaused={false}
        serverPlaybackSpeed={1}
        serverPlaying={false}
      />,
    );
    const rail = container.querySelector(".timeline-scrubber") as HTMLDivElement;
    Object.defineProperty(rail, "getBoundingClientRect", {
      value: () =>
        ({
          left: 100,
          width: 200,
        }) as DOMRect,
    });

    fireEvent.pointerDown(rail, { clientX: 150 });
    fireEvent.pointerMove(window, { clientX: 250 });
    fireEvent.pointerUp(window, { clientX: 250 });
    expect(onSeek).toHaveBeenCalledTimes(1);
    expect(onSeek.mock.calls[0]?.[0]).toEqual(expect.any(Number));
  });

  it("disables seek when no score", () => {
    const onSeek = vi.fn();
    const { container } = render(
      <TimelineScrubber
        onSeek={onSeek}
        score={null}
        serverElapsedMs={0}
        serverPaused={false}
        serverPlaybackSpeed={1}
        serverPlaying={false}
      />,
    );
    const rail = container.querySelector(".timeline-scrubber") as HTMLDivElement;
    fireEvent.pointerDown(rail, { clientX: 150 });
    fireEvent.pointerUp(window, { clientX: 250 });
    expect(onSeek).not.toHaveBeenCalled();
  });
});
