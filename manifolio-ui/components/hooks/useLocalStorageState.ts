import { useState, useEffect, useCallback } from "react";
import logger from "@/logger";
import useThrottle from "./useThrottle";

function getQueryParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(key);
}

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  throttleTime = 500,
  parseQueryParam: (value: string) => T = (value) => value as unknown as T
): [T, (value: T | ((val: T) => T)) => void] {
  function readValue(): T {
    if (typeof window === "undefined") {
      return initialValue;
    }

    // Prefer URL query parameter over local storage
    const queryValue = getQueryParam(key);
    if (queryValue) {
      return parseQueryParam(queryValue);
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      logger.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }

  const [liveValue, setLiveValue] = useState<T>(initialValue);

  const setStoredValue = useThrottle(
    (value: T) => {
      logger.debug("Setting localStorage key", key, "to", value);
      if (typeof window == "undefined") {
        logger.warn(
          `Tried setting localStorage key “${key}” even though environment is not a client`
        );
      }

      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        logger.warn(`Error setting localStorage key “${key}”:`, error);
      }
    },
    throttleTime,
    { leading: true, trailing: true }
  );

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setLiveValue((prev: T) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        setStoredValue(nextValue);
        return nextValue;
      });
    },
    [setStoredValue]
  );

  useEffect(() => {
    // Note that this only sets the live value, not the stored value. This means
    // that if you load a page with a query parameter, then don't change the field,
    // your old state will be restored when you refresh the page. I think this is the
    // correct behavior.
    setLiveValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [liveValue, setValue];
}
