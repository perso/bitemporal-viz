import type { SourceFile } from "../core/dataset";

export const STORAGE_KEY = "bitemporal-viz:sources:v1";

/** The browser's localStorage, or `null` where it is blocked (e.g. some private modes). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
}

/** Sources saved by an earlier visit; none when missing, unreadable or blocked. */
export function loadSources(storage: Storage | null = browserStorage()): SourceFile[] {
  if (storage === null) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw === null ? [] : parseSources(raw);
  } catch (error) {
    if (error instanceof DOMException || error instanceof SyntaxError) return [];
    throw error;
  }
}

/** Remember sources for the next visit; `false` when the browser refuses (full or blocked). */
export function saveSources(
  sources: readonly SourceFile[],
  storage: Storage | null = browserStorage(),
): boolean {
  if (storage === null) return false;
  try {
    if (sources.length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify(sources));
    return true;
  } catch (error) {
    if (error instanceof DOMException) return false;
    throw error;
  }
}

/**
 * Read stored JSON back into sources, dropping anything malformed.
 *
 * @example parseSources('[{"name":"party.csv","text":"..."}, 42]') // [{ name: "party.csv", ... }]
 */
export function parseSources(raw: string): SourceFile[] {
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed.filter(isSource) : [];
}

const isSource = (item: unknown): item is SourceFile =>
  typeof item === "object" &&
  item !== null &&
  typeof (item as SourceFile).name === "string" &&
  typeof (item as SourceFile).text === "string";
