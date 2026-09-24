import type { SourceFile } from "../core/dataset";

export const SOURCES_KEY = "bitemporal-viz:sources:v1";
export const VIEW_KEY = "bitemporal-viz:view:v1";
export const COLUMNS_KEY = "bitemporal-viz:columns:v1";

/** The browser's localStorage, or `null` where it is blocked (e.g. some private modes). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch (error) {
    if (error instanceof DOMException) return null;
    throw error;
  }
}

/** A stored JSON value run through `parse`; `fallback` when missing, unreadable or blocked. */
export function loadItem<T>(
  key: string,
  parse: (raw: unknown) => T,
  fallback: T,
  storage: Storage | null = browserStorage(),
): T {
  if (storage === null) return fallback;
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof DOMException || error instanceof SyntaxError) return fallback;
    throw error;
  }
}

/** Store a value as JSON; `undefined` removes it. `false` when the browser refuses. */
export function saveItem(
  key: string,
  value: unknown,
  storage: Storage | null = browserStorage(),
): boolean {
  if (storage === null) return false;
  try {
    if (value === undefined) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (error instanceof DOMException) return false;
    throw error;
  }
}

/**
 * Keep only well-formed sources from stored JSON.
 *
 * @example parseSources([{ name: "party.csv", text: "..." }, 42]) // [{ name: "party.csv", ... }]
 */
export function parseSources(raw: unknown): SourceFile[] {
  return Array.isArray(raw) ? raw.filter(isSource) : [];
}

const isSource = (item: unknown): item is SourceFile =>
  typeof item === "object" &&
  item !== null &&
  typeof (item as SourceFile).name === "string" &&
  typeof (item as SourceFile).text === "string";
