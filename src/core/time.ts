import { DataError } from "./errors";

/** An instant in epoch milliseconds; `OPEN` marks an open (unbounded) end. */
export type Instant = number;

export const OPEN: Instant = Number.POSITIVE_INFINITY;

/** Tech-time probe meaning "what we know now": after every closed instant, before `OPEN`. */
export const NOW: Instant = Number.MAX_SAFE_INTEGER;

const OPEN_MARKERS = new Set(["", "null", "none", "nat", "infinity"]);
const TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Parse an ISO-like timestamp; blanks, `null` and year 9999+ are open ends.
 * Timestamps without an offset are read as UTC so nothing shifts with the browser time zone.
 *
 * @example parseInstant("2024-06-01 08:15:00") // 1717229700000
 * @example parseInstant("9999-12-31") // OPEN
 */
export function parseInstant(raw: string): Instant {
  const text = raw.trim();
  if (OPEN_MARKERS.has(text.toLowerCase())) return OPEN;
  const match = TIMESTAMP.exec(text);
  if (match === null) throw new DataError(`Unrecognised timestamp "${raw}"`);
  const [, year, month, day, hour = "00", minute = "00", second = "00", fraction = "", zone] = match;
  if (Number(year) >= 9999) return OPEN;
  const millis = fraction.padEnd(3, "0").slice(0, 3);
  const offset = zone === undefined ? "Z" : normaliseOffset(zone);
  const parsed = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}.${millis}${offset}`);
  if (Number.isNaN(parsed)) throw new DataError(`Invalid timestamp "${raw}"`);
  return parsed;
}

function normaliseOffset(zone: string): string {
  if (zone.toUpperCase() === "Z") return "Z";
  return zone.includes(":") ? zone : `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

/**
 * Format an instant compactly in UTC, dropping a midnight time part.
 *
 * @example formatInstant(Date.UTC(2024, 5, 1)) // "2024-06-01"
 */
export function formatInstant(instant: Instant): string {
  if (instant === OPEN) return "∞";
  if (instant === NOW) return "now";
  const iso = new Date(instant).toISOString();
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 19);
  if (time === "00:00:00") return date;
  return `${date} ${time.endsWith(":00") ? time.slice(0, 5) : time}`;
}

/** Format a half-open interval `[from, to)`. */
export function formatInterval(from: Instant, to: Instant): string {
  return `${formatInstant(from)} → ${formatInstant(to)}`;
}
