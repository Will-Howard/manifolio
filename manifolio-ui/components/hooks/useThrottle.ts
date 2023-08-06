import { useEffect, useRef, useCallback } from "react";
import { DebouncedFunc, ThrottleSettings, throttle } from "lodash";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  wait?: number,
  options?: ThrottleSettings
): DebouncedFunc<T> {
  const latestCallback = useRef<T>(callback);

  useEffect(() => {
    latestCallback.current = callback;
  }, [callback]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const throttledFunction = useCallback(
    throttle(
      (...args: Parameters<T>) => latestCallback.current(...args),
      wait,
      options
    ),
    // Stringify to avoid infinite loop if the options are defined inline
    [wait, JSON.stringify(options)]
  );

  return throttledFunction;
}

export default useThrottle;
