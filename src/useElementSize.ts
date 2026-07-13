// Debounced ResizeObserver → {width,height} state, used by the json
// viewers. The debounce matters: every viewer rebuilds its whole scene
// when `size` changes, and a panel drag emits a ResizeObserver tick per
// frame — undebounced, that's a full d3/cytoscape teardown+rebuild ~60×/s,
// which is exactly the "moving panels freezes the app" bug. Trailing
// debounce means the rebuild lands once, after the drag settles.

import { useEffect, useState, type RefObject } from "react";

export function useElementSize(
  ref: RefObject<HTMLElement | null>,
  debounceMs = 150,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update(); // initial measure is immediate; only observer ticks debounce
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(update, debounceMs);
    });
    ro.observe(el);
    return () => {
      if (t !== undefined) window.clearTimeout(t);
      ro.disconnect();
    };
  }, [ref, debounceMs]);

  return size;
}
