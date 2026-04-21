import {
  FINGER_HEIGHT_PX,
  LABEL_BOTTOM_INSET_PX,
  LABEL_HEIGHT_PX,
  LABEL_TO_FINGER_GAP_PX,
  MIN_BAR_HEIGHT_FOR_FINGER_PX,
  MIN_BAR_HEIGHT_FOR_LABEL_PX,
} from "./constants";

/** 1–5 when showable; ``null`` if missing or out of range. */
export function resolveFingerDigit(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const v = Math.abs(Math.trunc(Number(raw)));
  if (v < 1 || v > 5) return null;
  return v;
}

export type NoteSpriteStackMode = "finger_and_label" | "label_only" | "none";

export function classifyNoteSpriteStack(
  barHeightPx: number,
  fingerDigit: number | null,
): NoteSpriteStackMode {
  if (barHeightPx >= MIN_BAR_HEIGHT_FOR_FINGER_PX && fingerDigit != null) {
    return "finger_and_label";
  }
  if (barHeightPx >= MIN_BAR_HEIGHT_FOR_LABEL_PX) {
    return "label_only";
  }
  return "none";
}

/** Local Y positions (bar-centred coords; +Y up) for finger + name stack from bar bottom. */
export function fingerAndLabelSpriteYs(barHeightPx: number): {
  yFinger: number;
  yName: number;
} {
  const yFinger =
    -barHeightPx / 2 + LABEL_BOTTOM_INSET_PX + FINGER_HEIGHT_PX / 2;
  const yName =
    yFinger +
    FINGER_HEIGHT_PX / 2 +
    LABEL_TO_FINGER_GAP_PX +
    LABEL_HEIGHT_PX / 2;
  return { yFinger, yName };
}

/** Pitch label only — original single-sprite position from bar bottom. */
export function labelOnlySpriteY(barHeightPx: number): number {
  return (
    -barHeightPx / 2 + LABEL_HEIGHT_PX / 2 + LABEL_BOTTOM_INSET_PX
  );
}
