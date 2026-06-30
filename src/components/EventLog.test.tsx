// @vitest-environment jsdom
import { render } from "solid-js/web";
import { describe, expect, it } from "vitest";

import { EventLog } from "./EventLog";
import type { EventLogEntry } from "../lib/event-log";

describe("EventLog", () => {
  it("renders empty-state hint", () => {
    const host = document.createElement("div");
    const dispose = render(() => <EventLog entries={[]} />, host);
    expect(host.textContent).toContain("Event log");
    expect(host.textContent).toContain("Events appear here as you play.");
    dispose();
  });

  it("renders validation and error lines", () => {
    const entries: EventLogEntry[] = [
      { id: 1, at: 1_700_000_000_000, kind: "validation", text: "Correct · pitch 60" },
      { id: 2, at: 1_700_000_000_100, kind: "error", text: "invalid_bpm: bpm must be positive" },
    ];
    const host = document.createElement("div");
    const dispose = render(() => <EventLog entries={entries} />, host);
    expect(host.textContent).toContain("Correct · pitch 60");
    expect(host.textContent).toContain("invalid_bpm");
    expect(host.querySelector(".event-log-validation")).not.toBeNull();
    expect(host.querySelector(".event-log-error")).not.toBeNull();
    dispose();
  });

  it("renders embedded log without panel heading", () => {
    const host = document.createElement("div");
    const dispose = render(() => <EventLog entries={[]} embedded />, host);
    expect(host.textContent).not.toContain("Event log");
    expect(host.textContent).toContain("Events appear here as you play.");
    dispose();
  });
});
