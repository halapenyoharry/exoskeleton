export interface DebouncedFunction<T extends (...args: any[]) => void> {
  (...args: Parameters<T>): void;
  flush(): void;
  cancel(): void;
}

/**
 * Creates a debounced function that delays invoking `fn` until after `ms`
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * Provides `.flush()` to execute any pending call immediately and `.cancel()` to abort.
 */
export function createDebounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number,
): DebouncedFunction<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: Parameters<T> | undefined;

  const debounced = (...args: Parameters<T>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      const a = lastArgs;
      lastArgs = undefined;
      if (a) fn(...a);
    }, ms);
  };

  debounced.flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
      const a = lastArgs;
      lastArgs = undefined;
      if (a) fn(...a);
    }
  };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
      lastArgs = undefined;
    }
  };

  return debounced;
}
