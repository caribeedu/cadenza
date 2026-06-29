import { describe, expect, it } from "vitest";
import {
  NOTE_INSTANCING_THRESHOLD,
  shouldUseNoteInstancing,
} from "./instanced-note-bars";

describe("shouldUseNoteInstancing", () => {
  it("enables at threshold for lava themes", () => {
    expect(shouldUseNoteInstancing(NOTE_INSTANCING_THRESHOLD, true)).toBe(true);
    expect(shouldUseNoteInstancing(NOTE_INSTANCING_THRESHOLD - 1, true)).toBe(false);
    expect(shouldUseNoteInstancing(88, true)).toBe(true);
  });

  it("stays off when lava bars disabled", () => {
    expect(shouldUseNoteInstancing(200, false)).toBe(false);
  });
});
