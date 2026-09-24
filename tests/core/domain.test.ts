import { describe, expect, it } from "vitest";

import { panDomain, paddedDomain, snapTo, techDomain, tidyInstant, validDomain, zoomDomain } from "../../src/core/domain";
import { OPEN } from "../../src/core/time";
import { day, version } from "../helpers";

const DAY = 86_400_000;

describe("paddedDomain", () => {
  it("pads both sides", () => {
    expect(paddedDomain([0, 100 * DAY], 0.1)).toEqual([-10 * DAY, 110 * DAY]);
  });

  it("allows extra headroom at the end", () => {
    expect(paddedDomain([0, 100 * DAY], 0, 0.5)).toEqual([0, 150 * DAY]);
  });

  it("widens a single instant to at least a day", () => {
    expect(paddedDomain([0, OPEN], 0.5)).toEqual([-0.5 * DAY, 0.5 * DAY]);
  });

  it("is null without finite instants", () => {
    expect(paddedDomain([OPEN])).toBeNull();
  });
});

describe("validDomain and techDomain", () => {
  const v = version({ validFrom: day("2024-01-01"), validTo: day("2024-01-11"), techFrom: day("2024-02-01"), techTo: OPEN });

  it("reads valid times", () => {
    expect(validDomain([v])?.[0]).toBeLessThan(day("2024-01-01"));
  });

  it("reads tech times with headroom above", () => {
    expect(techDomain([v])?.[1]).toBeGreaterThan(day("2024-02-01"));
  });
});

describe("zoomDomain", () => {
  it("keeps the anchor in place", () => {
    expect(zoomDomain([0, 100 * DAY], 50 * DAY, 0.5)).toEqual([25 * DAY, 75 * DAY]);
  });

  it("stops at a minimum span", () => {
    const [start, end] = zoomDomain([0, 1000], 500, 0.001);
    expect(end - start).toBe(60_000);
  });
});

describe("panDomain", () => {
  it("shifts both ends", () => {
    expect(panDomain([0, 10], 5)).toEqual([5, 15]);
  });
});

describe("snapTo", () => {
  it("snaps within tolerance", () => {
    expect(snapTo(98, [0, 100], 5)).toBe(100);
  });

  it("keeps the value outside tolerance", () => {
    expect(snapTo(90, [0, 100], 5)).toBe(90);
  });

  it("keeps the value without candidates", () => {
    expect(snapTo(90, [], 5)).toBe(90);
  });
});

describe("tidyInstant", () => {
  const HOUR = 3_600_000;

  it("snaps to a nearby change point", () => {
    expect(tidyInstant(day("2024-01-10") + 3 * HOUR, [day("2024-01-10")], HOUR)).toBe(day("2024-01-10"));
  });

  it("rounds to a day when zoomed out", () => {
    expect(tidyInstant(day("2024-01-10") + 13 * HOUR, [], HOUR)).toBe(day("2024-01-11"));
  });

  it("rounds to a minute when zoomed in", () => {
    expect(tidyInstant(day("2024-01-10") + 61_000, [], 1000)).toBe(day("2024-01-10") + 60_000);
  });
});
