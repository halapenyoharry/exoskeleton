// A short status message for a panel: "Copied ✓", "Saved to …", or an error.
// Success and info messages clear themselves; errors stay until replaced or
// dismissed, so a failure is never missed.

import { useCallback, useEffect, useRef, useState } from "react";

export type FlashKind = "ok" | "info" | "error";

export interface Flash {
  kind: FlashKind;
  text: string;
}

export function useFlash(clearAfterMs = 4000) {
  const [flash, setFlash] = useState<Flash | null>(null);
  const timer = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setFlash(null);
  }, []);

  const show = useCallback(
    (kind: FlashKind, text: string) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setFlash({ kind, text });
      if (kind !== "error") {
        timer.current = window.setTimeout(() => setFlash(null), clearAfterMs);
      }
    },
    [clearAfterMs],
  );

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  return { flash, show, clear };
}
