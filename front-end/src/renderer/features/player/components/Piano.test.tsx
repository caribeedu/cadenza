// @vitest-environment jsdom

import type { KeyboardLayout } from "@shared/types/geometry";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FLASH_DURATION_MS, Piano } from "./Piano";

function makeLayout(): KeyboardLayout {
  return {
    blackWidth: 12,
    blacks: [{ pitch: 61, width: 12, xCenter: 20, xLeft: 14 }],
    high: 61,
    laneCenterPx: () => 10,
    laneWidthPx: () => 12,
    low: 60,
    totalWidthPx: 40,
    whiteWidth: 20,
    whites: [{ pitch: 60, width: 20, xCenter: 10, xLeft: 0 }],
  };
}

function notePlayed(pitch: number) {
  return {
    correct: true,
    delta_ms: 0,
    expected_id: 1,
    expected_pitch: pitch,
    expected_time_ms: 0,
    played_pitch: pitch,
    played_time_ms: 0,
  };
}

describe("<Piano>", () => {
  it("keeps pressed color while key stays held", () => {
    vi.useFakeTimers();
    const layout = makeLayout();
    const { container, rerender } = render(
      <Piano
        heldMidiPitches={[60]}
        latestNotePlayed={notePlayed(60)}
        layout={layout}
      />,
    );
    const key = container.querySelector('rect[data-pitch="60"]');
    expect(key?.getAttribute("class") ?? "").toContain("key-pressed-good");

    vi.advanceTimersByTime(FLASH_DURATION_MS + 25);
    rerender(
      <Piano
        heldMidiPitches={[60]}
        latestNotePlayed={null}
        layout={layout}
      />,
    );
    expect(key?.getAttribute("class") ?? "").toContain("key-pressed-good");
    vi.useRealTimers();
  });

  it("clears neutral flash once no keys are held", () => {
    vi.useFakeTimers();
    const layout = makeLayout();
    const { container, rerender } = render(
      <Piano
        heldMidiPitches={[]}
        latestNotePlayed={{
          ...notePlayed(60),
          correct: null,
        }}
        layout={layout}
      />,
    );
    const key = container.querySelector('rect[data-pitch="60"]');
    expect(key?.getAttribute("class") ?? "").toContain("key-pressed-neutral");

    rerender(
      <Piano
        heldMidiPitches={[]}
        latestNotePlayed={null}
        layout={layout}
      />,
    );
    expect(key?.getAttribute("class") ?? "").not.toContain("key-pressed-neutral");
    vi.useRealTimers();
  });
});
