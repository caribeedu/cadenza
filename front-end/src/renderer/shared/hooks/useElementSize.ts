import { type RefObject, useEffect, useState } from "react";

export interface ElementSize {
  height: number;
  width: number;
}

// Observe `ref.current` size via a single ResizeObserver instance and
// expose the latest pixel dimensions as React state. Returns `null`
// until the element mounts and the observer reports its first entry,
// which lets consumers short-circuit layout math instead of rendering
// zero-sized outputs.
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
): ElementSize | null {
  const [size, setSize] = useState<ElementSize | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { height, width } = entry.contentRect;
      setSize({ height, width });
    });

    observer.observe(el);
    // Seed with the current rect so the first paint has valid numbers
    // even before the observer's first callback fires.
    const rect = el.getBoundingClientRect();
    setSize({ height: rect.height, width: rect.width });

    return () => observer.disconnect();
  }, [ref]);

  return size;
}
