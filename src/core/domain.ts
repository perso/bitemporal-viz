import type { Version } from "./dataset";
import { changePoints } from "./bitemporal";
import type { Instant } from "./time";

/** A visible time range `[start, end]` in epoch milliseconds. */
export type Domain = readonly [Instant, Instant];

const DAY = 86_400_000;
const MIN_SPAN = 60_000;

/**
 * The range covering every finite instant, padded so open ends have room to run off the edge.
 *
 * @example paddedDomain([0, 100 * DAY], 0.1) // [-10 * DAY, 110 * DAY]
 * @example paddedDomain([0, 100 * DAY], 0, 0.5) // [0, 150 * DAY]
 */
export function paddedDomain(
  instants: readonly Instant[],
  padding = 0.06,
  headroom = padding,
): Domain | null {
  const finite = changePoints(instants);
  const first = finite[0];
  const last = finite.at(-1);
  if (first === undefined || last === undefined) return null;
  const span = Math.max(last - first, DAY);
  return [first - span * padding, last + span * headroom];
}

/** Padded domain over the valid-time axis of some versions. */
export const validDomain = (versions: readonly Version[]): Domain | null =>
  paddedDomain(versions.flatMap((v) => [v.validFrom, v.validTo]));

/** Padded domain over the tech-time axis, with headroom so current versions get visible area. */
export const techDomain = (versions: readonly Version[]): Domain | null =>
  paddedDomain(versions.flatMap((v) => [v.techFrom, v.techTo]), 0.04, 0.25);

/**
 * Scale a domain around `anchor`, keeping the anchor at the same screen position.
 *
 * @example zoomDomain([0, 100], 50, 0.5) // [25, 75]
 */
export function zoomDomain(domain: Domain, anchor: Instant, factor: number): Domain {
  const [start, end] = domain;
  const span = Math.max((end - start) * factor, MIN_SPAN);
  const ratio = (anchor - start) / (end - start);
  return [anchor - span * ratio, anchor + span * (1 - ratio)];
}

/** Shift a domain by `delta` milliseconds. */
export const panDomain = ([start, end]: Domain, delta: number): Domain => [
  start + delta,
  end + delta,
];

/**
 * The candidate nearest to `value` if it lies within `tolerance`, else `value` itself.
 *
 * @example snapTo(98, [0, 100], 5) // 100
 */
export function snapTo(value: number, candidates: readonly number[], tolerance: number): number {
  const nearest = candidates.reduce<number | null>(
    (best, c) => (best === null || Math.abs(c - value) < Math.abs(best - value) ? c : best),
    null,
  );
  return nearest !== null && Math.abs(nearest - value) <= tolerance ? nearest : value;
}

const HOUR = 3_600_000;
const MINUTE = 60_000;

/**
 * Turn a clicked instant into a tidy one: a nearby change point, else a whole day or minute.
 *
 * @example tidyInstant(jan10 + 3 * HOUR, [jan10], DAY) // jan10 (snapped)
 */
export function tidyInstant(
  instant: Instant,
  changes: readonly Instant[],
  millisPerPixel: number,
): Instant {
  const snapped = snapTo(instant, changes, millisPerPixel * 8);
  if (snapped !== instant) return snapped;
  const unit = millisPerPixel >= HOUR ? DAY : MINUTE;
  return Math.round(instant / unit) * unit;
}
