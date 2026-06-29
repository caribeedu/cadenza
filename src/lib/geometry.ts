export interface KeySlot {
  pitch: number;
  width: number;
  xCenter: number;
  xLeft: number;
}

export interface LaneGeometry {
  laneCenterPx: (pitch: number) => number;
  laneWidthPx: (pitch: number) => number;
}

export interface KeyboardLayout extends LaneGeometry {
  blacks: KeySlot[];
  blackWidth: number;
  high: number;
  low: number;
  totalWidthPx: number;
  whites: KeySlot[];
  whiteWidth: number;
}
