// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it, vi } from "vitest";
import { TimelineScrubber } from "./TimelineScrubber";

describe("TimelineScrubber", () => {
  it("renders disabled scrubber when not enabled", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <TimelineScrubber
          notes={[{ start_ms: 0 }, { start_ms: 500 }]}
          durationMs={1000}
          positionMs={0}
          playing={false}
          paused={false}
          speed={1}
          enabled={false}
          onSeek={() => undefined}
        />
      ),
      host,
    );
    expect(host.querySelector('.timeline[data-enabled="0"]')).not.toBeNull();
    dispose();
  });

  it("renders bins and thumb when enabled", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <TimelineScrubber
          notes={[{ start_ms: 100 }, { start_ms: 200 }]}
          durationMs={1000}
          positionMs={250}
          playing={false}
          paused={false}
          speed={1}
          enabled
          onSeek={() => undefined}
        />
      ),
      host,
    );
    expect(host.querySelector('.timeline[data-enabled="1"]')).not.toBeNull();
    expect(host.querySelectorAll(".timeline-scrubber__bin").length).toBeGreaterThan(0);
    expect(host.querySelector(".timeline-scrubber__thumb")).not.toBeNull();
    dispose();
  });

  it("exposes slider role and thumb when enabled", () => {
    const host = document.createElement("div");
    const dispose = render(
      () => (
        <TimelineScrubber
          notes={[]}
          durationMs={1000}
          positionMs={0}
          playing={false}
          paused={false}
          speed={1}
          enabled
          onSeek={() => undefined}
        />
      ),
      host,
    );
    expect(host.querySelector('[role="slider"]')).not.toBeNull();
    dispose();
  });
});
