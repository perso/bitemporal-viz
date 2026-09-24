import { useRef, useState } from "react";

import type { SourceFile } from "../core/dataset";
import { browserStorage, loadSources, saveSources } from "../io/storage";

export type PersistentSources = {
  readonly sources: readonly SourceFile[];
  readonly setSources: (update: (current: readonly SourceFile[]) => readonly SourceFile[]) => void;
  /** `false` when the browser refused to store the current sources. */
  readonly remembered: boolean;
};

/** Loaded CSVs, kept in this browser's localStorage so they survive a reload. */
export function usePersistentSources(storage: Storage | null = browserStorage()): PersistentSources {
  const [state, setState] = useState<{ sources: readonly SourceFile[]; remembered: boolean }>(() => ({
    sources: loadSources(storage),
    remembered: true,
  }));
  // Tracks the latest sources between renders, so two quick updates do not overwrite each other.
  const latest = useRef(state.sources);
  const setSources: PersistentSources["setSources"] = (update) => {
    const sources = update(latest.current);
    latest.current = sources;
    setState({ sources, remembered: saveSources(sources, storage) });
  };
  return { ...state, setSources };
}
