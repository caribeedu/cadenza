import {
  LH_PENDING_BLACK_HEX,
  LH_PENDING_WHITE_HEX,
  pendingNoteColorHex,
  RH_PENDING_BLACK_HEX,
  RH_PENDING_WHITE_HEX,
} from "./note-hand-colors";
import { describe, expect, it } from "vitest";

describe("pendingNoteColorHex", () => {
  it("uses purple variants for left hand (staff 1)", () => {
    expect(pendingNoteColorHex(1, 60)).toBe(LH_PENDING_WHITE_HEX);
    expect(pendingNoteColorHex(1, 61)).toBe(LH_PENDING_BLACK_HEX);
  });

  it("uses blue variants for right hand (staff 0)", () => {
    expect(pendingNoteColorHex(0, 60)).toBe(RH_PENDING_WHITE_HEX);
    expect(pendingNoteColorHex(0, 61)).toBe(RH_PENDING_BLACK_HEX);
  });

  it("treats undefined staff as right hand", () => {
    expect(pendingNoteColorHex(undefined, 64)).toBe(RH_PENDING_WHITE_HEX);
  });
});
