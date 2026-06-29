import { createSignal, onCleanup, onMount } from "solid-js";

export function useElementWidth() {
  const [width, setWidth] = createSignal(0);
  let el: HTMLElement | undefined;

  onMount(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    onCleanup(() => ro.disconnect());
  });

  const ref = (node: HTMLElement) => {
    el = node;
  };

  return { ref, width };
}
