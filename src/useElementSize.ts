import { useEffect, useRef, useState, type RefObject } from "react";

// Measures an element and tracks its size through a (debounced)
// ResizeObserver.
//
// The observed element may mount LATE: json-graph and json-cytoscape only
// render their canvas div once a document is detected, so `ref.current` is
// null on the first effect run. An effect keyed on `[ref]` would attach to
// nothing and never re-run (the ref object's identity never changes), leaving
// the size at 0×0 and the draw effect gated off forever. So this effect runs
// after every render and re-attaches only when the element identity changes.
export function useElementSize(
  ref: RefObject<HTMLElement | null>,
  debounceMs = 150,
): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observed = useRef<HTMLElement | null>(null);
  const cleanup = useRef<() => void>(() => {});

  useEffect(() => {
    const el = ref.current;
    if (el === observed.current) return; // same target: nothing to do
    cleanup.current();
    observed.current = el;
    if (!el) {
      cleanup.current = () => {};
      setSize({ width: 0, height: 0 });
      return;
    }
    const update = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    update(); // initial measure is immediate; only observer ticks debounce
    let t: number | undefined;
    const ro = new ResizeObserver(() => {
      if (t !== undefined) window.clearTimeout(t);
      t = window.setTimeout(update, debounceMs);
    });
    ro.observe(el);
    cleanup.current = () => {
      if (t !== undefined) window.clearTimeout(t);
      ro.disconnect();
    };
  });

  // Detach on unmount.
  useEffect(() => () => cleanup.current(), []);

  return size;
}
