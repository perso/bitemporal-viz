import { describe, expect, it } from "vitest";

import {
  changePoints,
  findConflicts,
  groupBy,
  isCurrent,
  isKnownAt,
  isValidAt,
  knownAt,
  rectanglesOverlap,
  snapshot,
  techChangePoints,
  validChangePoints,
} from "../../src/core/bitemporal";
import { NOW, OPEN } from "../../src/core/time";
import { day, version } from "../helpers";

const superseded = version({ techFrom: day("2024-01-01"), techTo: day("2024-03-01") });
const correction = version({ techFrom: day("2024-03-01"), validTo: day("2024-06-01") });

describe("isKnownAt", () => {
  it("includes the tech start", () => {
    expect(isKnownAt(superseded, day("2024-01-01"))).toBe(true);
  });

  it("excludes the tech end", () => {
    expect(isKnownAt(superseded, day("2024-03-01"))).toBe(false);
  });

  it("treats NOW as after every closed instant", () => {
    expect(isKnownAt(correction, NOW)).toBe(true);
  });
});

describe("isValidAt", () => {
  it("excludes the valid end", () => {
    expect(isValidAt(correction, day("2024-06-01"))).toBe(false);
  });
});

describe("isCurrent", () => {
  it("is true only without a tech end", () => {
    expect([isCurrent(superseded), isCurrent(correction)]).toEqual([false, true]);
  });
});

describe("knownAt", () => {
  it("returns the belief at a tech time", () => {
    expect(knownAt([superseded, correction], day("2024-02-01"))).toEqual([superseded]);
  });
});

describe("snapshot", () => {
  it("filters on both axes", () => {
    expect(snapshot([superseded, correction], day("2024-07-01"), NOW)).toEqual([]);
  });
});

describe("rectanglesOverlap", () => {
  it("is false for rectangles that only touch", () => {
    expect(rectanglesOverlap(superseded, correction)).toBe(false);
  });

  it("is true for shared area", () => {
    expect(rectanglesOverlap(correction, version({ validFrom: day("2024-05-01") }))).toBe(true);
  });
});

describe("findConflicts", () => {
  it("flags both overlapping versions of one lane", () => {
    const clash = version({ techFrom: day("2024-04-01") });
    expect(findConflicts([superseded, correction, clash])).toEqual(new Set([correction.id, clash.id]));
  });

  it("ignores overlaps across lanes", () => {
    expect(findConflicts([correction, version({ lane: "t 2" })]).size).toBe(0);
  });
});

describe("change points", () => {
  it("sorts, dedupes and drops open ends", () => {
    expect(changePoints([3, OPEN, 1, 3])).toEqual([1, 3]);
  });

  it("collects tech instants", () => {
    expect(techChangePoints([superseded, correction])).toEqual([day("2024-01-01"), day("2024-03-01")]);
  });

  it("collects valid instants", () => {
    expect(validChangePoints([correction])).toEqual([day("2024-01-01"), day("2024-06-01")]);
  });
});

describe("groupBy", () => {
  it("keeps first-seen key order", () => {
    expect([...groupBy(["b1", "a1", "b2"], (s) => s[0] ?? "").entries()]).toEqual([
      ["b", ["b1", "b2"]],
      ["a", ["a1"]],
    ]);
  });
});
