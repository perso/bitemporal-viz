import { describe, expect, it } from "vitest";

import { buildDataset } from "../../src/core/dataset";
import { NOW, parseInstant } from "../../src/core/time";
import { deriveView } from "../../src/core/view";
import { SAMPLE_SOURCES } from "../../src/sample";

const dataset = buildDataset(SAMPLE_SOURCES);

describe("deriveView", () => {
  it("shows current knowledge by default", () => {
    expect(deriveView(dataset, { seed: null, hops: 1, asOf: NOW }).shown).toHaveLength(18);
  });

  it("shows every version for 'all'", () => {
    expect(deriveView(dataset, { seed: null, hops: 1, asOf: "all" }).shown).toHaveLength(31);
  });

  it("rewinds to an earlier tech time", () => {
    const view = deriveView(dataset, { seed: "party:3", hops: 0, asOf: parseInstant("2024-03-02") });
    expect(view.shown.map((v) => v.label)).toEqual(["Carol Ltf"]);
  });

  it("finds no conflicts in the sample", () => {
    expect(deriveView(dataset, { seed: null, hops: 1, asOf: "all" }).conflicts.size).toBe(0);
  });

  it("lays out lanes in table order", () => {
    const view = deriveView(dataset, { seed: "group:11", hops: 1, asOf: NOW });
    expect(view.lanes.map((l) => l.table)).toEqual(["party", "party", "group", "connection", "group_connection", "joined"]);
  });

  it("offers the tech change points of the filtered rows", () => {
    expect(deriveView(dataset, { seed: "party:2", hops: 0, asOf: NOW }).techPoints).toEqual([
      parseInstant("2024-02-15 10:00:00"),
    ]);
  });
});
