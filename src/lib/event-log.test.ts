import { describe, expect, it } from "vitest";
import { appendEventLog } from "./event-log";

describe("appendEventLog", () => {
  it("prepends entries and caps length", () => {
    let log = appendEventLog([], "info", "first");
    log = appendEventLog(log, "score", "second");
    expect(log).toHaveLength(2);
    expect(log[0]?.text).toBe("second");
    expect(log[1]?.text).toBe("first");
  });

  it("assigns monotonic ids", () => {
    const a = appendEventLog([], "info", "a")[0]!.id;
    const b = appendEventLog(appendEventLog([], "info", "a"), "info", "b")[0]!.id;
    expect(b).toBeGreaterThan(a);
  });

  it("supports validation lines for EventLog panel", () => {
    const entries = appendEventLog([], "validation", "Correct · pitch 60");
    expect(entries[0]?.kind).toBe("validation");
    expect(entries[0]?.text).toContain("60");
  });
});
