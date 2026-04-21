/** Layout constants for note bars, pitch labels, and finger digits (screen px). */

export const LABEL_WIDTH_PX = 26;
export const LABEL_HEIGHT_PX = 16;
export const FINGER_WIDTH_PX = 12;
export const FINGER_HEIGHT_PX = 12;
export const LABEL_BOTTOM_INSET_PX = 3;
export const LABEL_TO_FINGER_GAP_PX = 3;

export const MIN_BAR_HEIGHT_FOR_LABEL_PX =
  LABEL_HEIGHT_PX + LABEL_BOTTOM_INSET_PX * 2;

export const MIN_BAR_HEIGHT_FOR_FINGER_PX =
  LABEL_HEIGHT_PX +
  FINGER_HEIGHT_PX +
  LABEL_BOTTOM_INSET_PX * 2 +
  LABEL_TO_FINGER_GAP_PX;
