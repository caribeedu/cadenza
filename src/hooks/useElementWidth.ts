import { createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Tracks an element's content width via ResizeObserver.
 * Pass `ref` to the host element (Solid signal-setter ref pattern).
 */
export function useElementWidth() {
  const [width, setWidth] = createSignal(0);
  const [el, setEl] = createSignal<HTMLElement | undefined>();

  createEffect(() => {
    const node = el();
    if (!node) return;

    const measure = () => {
      const w = node.clientWidth;
      if (w > 0) setWidth(w);
    };

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setWidth(w);
    });
    ro.observe(node);
    measure();

    onCleanup(() => ro.disconnect());
  });

  return { ref: setEl, width };
}
