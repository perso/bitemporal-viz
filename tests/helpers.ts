import type { Version } from "../src/core/dataset";
import { OPEN } from "../src/core/time";

export const day = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

let counter = 0;

/** A version with open ends unless overridden. */
export function version(overrides: Partial<Version> = {}): Version {
  counter += 1;
  return {
    id: `t#${counter}`,
    table: "t",
    lane: "t 1",
    laneLabel: "t 1",
    label: "",
    record: {},
    refs: [],
    keyRefs: [],
    validFrom: day("2024-01-01"),
    validTo: OPEN,
    techFrom: day("2024-01-01"),
    techTo: OPEN,
    ...overrides,
  };
}
