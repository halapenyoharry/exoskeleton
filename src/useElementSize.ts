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
    if (el === observed.current) {
      // Same target. Dockview detaches hidden tabs' DOM and re-attaches it
      // on show; Chromium does not always deliver a ResizeObserver entry
      // for that re-attach, so re-measure on every render and, while we
      // still read 0×0 on a connected element, poll until a size appears.
      if (el && el.isConnected) {
        const w = el.clientWidth;
        const h = el.clientHeight;
        setSize((s) => (s.width === w && s.height === h ? s : { width: w, height: h }));
      }
      return;
    }
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
    // Fallback poll while hidden/detached (0×0): stops as soon as a real
    // size is read or the element changes.
    const poll = window.setInterval(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        update();
        window.clearInterval(poll);
      }
    }, 250);
    cleanup.current = () => {
      if (t !== undefined) window.clearTimeout(t);
      window.clearInterval(poll);
      ro.disconnect();
    };
  });

  // Detach on unmount.
  useEffect(() => () => cleanup.current(), []);

  return size;
}
