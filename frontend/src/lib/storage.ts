import { useState, useEffect, useCallback } from "react";

const PREFIX = "sentinel-";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const storageKey = PREFIX + key;
  const [storedValue, setStoredValue] = useState<T>(initialValue);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(storageKey);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch {}
  }, [storageKey]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(nextValue));
        } catch {}
        return nextValue;
      });
    },
    [storageKey]
  );

  return [storedValue, setValue];
}

export function clearAllData() {
  if (typeof window === "undefined") return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => window.localStorage.removeItem(k));
}

export function getStorageSize(): string {
  if (typeof window === "undefined") return "0 B";
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)!;
    const value = window.localStorage.getItem(key) || "";
    total += key.length + value.length;
  }
  if (total < 1024) return `${total} B`;
  return `${(total / 1024).toFixed(1)} KB`;
}

export function getStorageEntries(): number {
  if (typeof window === "undefined") return 0;
  return Object.keys(window.localStorage).filter((k) =>
    k.startsWith(PREFIX)
  ).length;
}
