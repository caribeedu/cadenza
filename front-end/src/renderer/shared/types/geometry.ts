// Shape of a single key's computed horizontal geometry.
export interface KeySlot {
  pitch: number;
  width: number;
  xCenter: number;
  xLeft: number;
}

// Minimal interface the Three.js waterfall needs from whatever produces
// the piano's layout. Abstracting it this way lets future visualisation
// modes (piano-roll, staff) share lane math without reimplementing the
// renderer.
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
