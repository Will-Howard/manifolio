import { useState, useEffect } from "react";
import { throttle } from "lodash";

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  throttleTime = 1000
): [T, (value: T | ((val: T) => T)) => void] {
  function readValue(): T {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key “${key}”:`, error);
      return initialValue;
    }
  }

  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const setThrottledStoredValue = throttle(setStoredValue, throttleTime);

  function setValue(value: T | ((val: T) => T)): void {
    if (typeof window == "undefined") {
      console.warn(
        `Tried setting localStorage key “${key}” even though environment is not a client`
      );
    }

    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;

      setThrottledStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key “${key}”:`, error);
    }
  }

  useEffect(() => {
    setStoredValue(readValue());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [storedValue, setValue];
}
