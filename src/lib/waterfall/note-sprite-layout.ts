import type { NoteSpritesDims } from "./theme";

export function resolveFingerDigit(raw: unknown): number | null {
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const v = Math.abs(Math.trunc(Number(raw)));
  if (v < 1 || v > 5) return null;
  return v;
}

export type NoteSpriteStackMode = "finger_and_label" | "label_only" | "none";

export function minBarHeightForFingerPx(s: NoteSpritesDims): number {
  return (
    s.labelHeightPx + s.fingerHeightPx + s.labelBottomInsetPx * 2 + s.labelToFingerGapPx
  );
}

export function minBarHeightForLabelPx(s: NoteSpritesDims): number {
  return s.labelHeightPx + s.labelBottomInsetPx * 2;
}

export function classifyNoteSpriteStack(
  barHeightPx: number,
  fingerDigit: number | null,
  sprites: NoteSpritesDims,
): NoteSpriteStackMode {
  if (barHeightPx >= minBarHeightForFingerPx(sprites) && fingerDigit != null) {
    return "finger_and_label";
  }
  if (barHeightPx >= minBarHeightForLabelPx(sprites)) {
    return "label_only";
  }
  return "none";
}

export function fingerAndLabelSpriteYs(
  barHeightPx: number,
  sprites: NoteSpritesDims,
): { yFinger: number; yName: number } {
  const yFinger = -barHeightPx / 2 + sprites.labelBottomInsetPx + sprites.fingerHeightPx / 2;
  const yName =
    yFinger + sprites.fingerHeightPx / 2 + sprites.labelToFingerGapPx + sprites.labelHeightPx / 2;
  return { yFinger, yName };
}

export function labelOnlySpriteY(barHeightPx: number, sprites: NoteSpritesDims): number {
  return -barHeightPx / 2 + sprites.labelHeightPx / 2 + sprites.labelBottomInsetPx;
}
