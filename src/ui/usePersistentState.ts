import { useRef, useState } from "react";

import { browserStorage, loadItem, saveItem } from "../io/storage";

export type PersistentState<T> = {
  readonly value: T;
  readonly set: (update: (current: T) => T) => void;
  /** Back to `initial`, and forgotten by the browser. */
  readonly reset: () => void;
  /** `false` when the browser refused to store the latest value. */
  readonly remembered: boolean;
};

/**
 * State mirrored into this browser's localStorage under `key`, so it survives a reload.
 *
 * @example const view = usePersistentState(VIEW_KEY, parseViewState, DEFAULT_VIEW_STATE);
 */
export function usePersistentState<T>(
  key: string,
  parse: (raw: unknown) => T,
  initial: T,
  storage: Storage | null = browserStorage(),
): PersistentState<T> {
  const [state, setState] = useState<{ value: T; remembered: boolean }>(() => ({
    value: loadItem(key, parse, initial, storage),
    remembered: true,
  }));
  // Tracks the latest value between renders, so two quick updates do not overwrite each other.
  const latest = useRef(state.value);
  const store = (value: T, stored: unknown): void => {
    latest.current = value;
    setState({ value, remembered: saveItem(key, stored, storage) });
  };
  return {
    ...state,
    set: (update) => {
      const value = update(latest.current);
      store(value, value);
    },
    reset: () => store(initial, undefined),
  };
}
