import { isAccidental } from "./timeline";

/** Left-hand (bass staff) — purple: lighter on white keys, deeper on black. */
export const LH_PENDING_WHITE_HEX = 0xc9a8f5;
export const LH_PENDING_BLACK_HEX = 0x7b52c4;

/** Right-hand (treble staff) — blue: lighter on white keys, deeper on black. */
export const RH_PENDING_WHITE_HEX = 0x6eb8ff;
export const RH_PENDING_BLACK_HEX = 0x2a6fc4;

/** Grand staff: staff `1` is bass / left hand; staff `0` is treble / right. */
export function isLeftHandStaff(staff: number | undefined): boolean {
  return staff === 1;
}

/** Pending note fill colour before play validation (hex, sRGB). */
export function pendingNoteColorHex(
  staff: number | undefined,
  pitch: number,
): number {
  const black = isAccidental(pitch);
  const lh = isLeftHandStaff(staff);
  if (lh) {
    return black ? LH_PENDING_BLACK_HEX : LH_PENDING_WHITE_HEX;
  }
  return black ? RH_PENDING_BLACK_HEX : RH_PENDING_WHITE_HEX;
}
