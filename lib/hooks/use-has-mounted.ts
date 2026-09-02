"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * True only after client-side hydration. Avoids the classic
 * `useState(false) + useEffect(() => setMounted(true))` pattern (which
 * the react-hooks/set-state-in-effect lint rule flags as an
 * unnecessary synchronous setState-in-effect) by reading mount status
 * declaratively instead.
 */
export function useHasMounted() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
