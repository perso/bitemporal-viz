import type { Version } from "./dataset";
import { type Instant, OPEN } from "./time";

type Rectangle = Pick<Version, "validFrom" | "validTo" | "techFrom" | "techTo">;

/** Was this version part of the database's belief at tech time `t`? */
export const isKnownAt = (v: Rectangle, t: Instant): boolean => v.techFrom <= t && t < v.techTo;

/** Is this version in effect at business time `t`? */
export const isValidAt = (v: Rectangle, t: Instant): boolean => v.validFrom <= t && t < v.validTo;

/** Is this version still current knowledge (no tech end)? */
export const isCurrent = (v: Rectangle): boolean => v.techTo === OPEN;

/** Versions believed at tech time `t` — the table as it looked then. */
export const knownAt = (versions: readonly Version[], t: Instant): Version[] =>
  versions.filter((v) => isKnownAt(v, t));

/** Versions valid at `validTime` as known at `techTime` — one point on both axes. */
export const snapshot = (
  versions: readonly Version[],
  validTime: Instant,
  techTime: Instant,
): Version[] => versions.filter((v) => isValidAt(v, validTime) && isKnownAt(v, techTime));

/** Do two half-open rectangles share any area? */
export const rectanglesOverlap = (a: Rectangle, b: Rectangle): boolean =>
  a.validFrom < b.validTo &&
  b.validFrom < a.validTo &&
  a.techFrom < b.techTo &&
  b.techFrom < a.techTo;

/**
 * Ids of versions whose rectangle overlaps another version of the same lane.
 * A well-formed bitemporal table has none: overlap means two facts claim the same time.
 */
export function findConflicts(versions: readonly Version[]): Set<string> {
  const conflicts = new Set<string>();
  for (const lane of groupBy(versions, (v) => `${v.table}/${v.lane}`).values()) {
    lane.forEach((a, i) =>
      lane.slice(i + 1).forEach((b) => {
        if (!rectanglesOverlap(a, b)) return;
        conflicts.add(a.id);
        conflicts.add(b.id);
      }),
    );
  }
  return conflicts;
}

/** Sorted, distinct, finite instants — the points where something changes. */
export const changePoints = (instants: readonly Instant[]): Instant[] =>
  [...new Set(instants.filter((t) => t !== OPEN))].sort((a, b) => a - b);

/** Every tech-time instant at which the database's belief changed. */
export const techChangePoints = (versions: readonly Version[]): Instant[] =>
  changePoints(versions.flatMap((v) => [v.techFrom, v.techTo]));

/** Every business-time instant at which some version starts or ends. */
export const validChangePoints = (versions: readonly Version[]): Instant[] =>
  changePoints(versions.flatMap((v) => [v.validFrom, v.validTo]));

/** Group items by key, keeping first-seen key order. */
export function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  return groups;
}
