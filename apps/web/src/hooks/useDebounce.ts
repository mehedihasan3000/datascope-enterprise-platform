'use client';

import { useEffect, useState } from 'react';

/**
 * Delays propagating rapid value changes (e.g. search keystrokes, numeric bounds)
 * until the user pauses for `delayMs` (defaults to 300ms per ADR-06).
 */
export function useDebounce<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
