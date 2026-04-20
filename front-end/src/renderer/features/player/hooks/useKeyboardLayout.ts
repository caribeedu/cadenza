import type { KeyboardLayout } from "@shared/types/geometry";

import { computeKeyboardLayout } from "@shared/lib/piano-layout";
import { HIGHEST_MIDI, LOWEST_MIDI } from "@shared/lib/timeline";
import { useMemo } from "react";

export interface UseKeyboardLayoutOptions {
  high?: number;
  low?: number;
  width?: null | number;
}

// Memoise the piano layout so re-renders don't re-allocate the lookup
// maps; the closures returned by ``computeKeyboardLayout`` are stable
// as long as the inputs are. Returns ``null`` when the host width is
// not yet known so the waterfall can skip rendering gracefully.
export function useKeyboardLayout({
  high = HIGHEST_MIDI,
  low = LOWEST_MIDI,
  width,
}: UseKeyboardLayoutOptions = {}): KeyboardLayout | null {
  return useMemo(() => {
    if (!(typeof width === "number" && width > 0)) return null;
    return computeKeyboardLayout({ high, low, totalWidthPx: width });
  }, [width, low, high]);
}
