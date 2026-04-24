/** Layout helpers derived from {@link WaterfallVisualTheme.noteSprites}. */

import type { NoteSpritesDims } from "@app/theme/theme";

export function minBarHeightForFingerPx(s: NoteSpritesDims): number {
  return (
    s.labelHeightPx +
    s.fingerHeightPx +
    s.labelBottomInsetPx * 2 +
    s.labelToFingerGapPx
  );
}

export function minBarHeightForLabelPx(s: NoteSpritesDims): number {
  return s.labelHeightPx + s.labelBottomInsetPx * 2;
}
