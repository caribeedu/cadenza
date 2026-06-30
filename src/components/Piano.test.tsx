// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";

import { computeKeyboardLayout } from "../lib/piano-layout";
import { HIGHEST_MIDI, LOWEST_MIDI } from "../lib/timeline";
import { Piano } from "./Piano";

describe("Piano", () => {
  it("renders white and black keys when layout is provided", () => {
    const layout = computeKeyboardLayout({
      low: LOWEST_MIDI,
      high: HIGHEST_MIDI,
      totalWidthPx: 720,
    });
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Piano
          layout={layout}
          latestNotePlayed={null}
          heldMidiPitches={[]}
        />
      ),
      host,
    );
    expect(host.querySelector("svg.piano-svg")).not.toBeNull();
    expect(host.querySelectorAll(".key-white").length).toBe(layout.whites.length);
    expect(host.querySelectorAll(".key-black").length).toBe(layout.blacks.length);
    dispose();
  });

  it("renders nothing when layout is null", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <Piano layout={null} latestNotePlayed={null} heldMidiPitches={[]} />
      ),
      host,
    );
    expect(host.querySelector("svg")).toBeNull();
    dispose();
  });
});
