import { scaleUtc } from "d3-scale";

import type { Domain } from "../core/domain";
import type { Instant } from "../core/time";

/** How far past the plot edge an off-screen or open end is drawn, so it is clipped cleanly. */
export const OVERFLOW = 24;

export type Tick = { readonly value: Instant; readonly label: string };

export type TimeScale = {
  readonly position: (t: Instant) => number;
  readonly invert: (px: number) => Instant;
  readonly ticks: readonly Tick[];
};

/**
 * Map instants onto pixels; open and out-of-range ends land just beyond the range.
 *
 * @example timeScale([0, 1000], [100, 200], 5).position(500) // 150
 */
export function timeScale(domain: Domain, range: readonly [number, number], tickCount: number): TimeScale {
  const scale = scaleUtc().domain(domain).range(range);
  const direction = Math.sign(range[1] - range[0]);
  const format = scale.tickFormat(tickCount);
  const position = (t: Instant): number => {
    if (t > domain[1]) return range[1] + direction * OVERFLOW;
    if (t < domain[0]) return range[0] - direction * OVERFLOW;
    return scale(t);
  };
  return {
    position,
    invert: (px) => scale.invert(px).getTime(),
    ticks: scale.ticks(tickCount).map((date) => ({ value: date.getTime(), label: format(date) })),
  };
}
