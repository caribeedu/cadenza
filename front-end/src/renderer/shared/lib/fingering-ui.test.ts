import { formatFingeringProgressLabel } from "./fingering-ui";
import { describe, expect, it } from "vitest";

describe("formatFingeringProgressLabel", () => {
  it("formats left-hand progress with percent and counts", () => {
    expect(
      formatFingeringProgressLabel({ done: 1, hand: "left", total: 2 }),
    ).toBe("Assigning left hand fingers 50% (1 of 2)");
  });

  it("formats right-hand progress at start", () => {
    expect(
      formatFingeringProgressLabel({ done: 0, hand: "right", total: 3 }),
    ).toBe("Assigning right hand fingers 0% (0 of 3)");
  });

  it("clamps total to at least 1 to avoid division issues", () => {
    expect(
      formatFingeringProgressLabel({ done: 0, hand: "right", total: 0 }),
    ).toBe("Assigning right hand fingers 0% (0 of 1)");
  });
});
