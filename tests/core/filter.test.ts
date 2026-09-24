import { describe, expect, it } from "vitest";

import { allVersions, buildDataset } from "../../src/core/dataset";
import { entityIds, entityNames, naturalCompare, neighbourhood, relatedVersions } from "../../src/core/filter";
import { SAMPLE_SOURCES } from "../../src/sample";

const versions = allVersions(buildDataset(SAMPLE_SOURCES));
const lanes = (seed: string, hops: number) =>
  [...new Set(relatedVersions(versions, seed, hops).map((v) => v.lane))];

describe("neighbourhood", () => {
  it("is just the seed at zero hops", () => {
    expect(neighbourhood(versions, "connection:100", 0)).toEqual(new Set(["connection:100"]));
  });

  it("reaches the parties and group of a connection in one hop", () => {
    expect(neighbourhood(versions, "connection:100", 1)).toEqual(
      new Set(["connection:100", "party:1", "party:2", "group:10"]),
    );
  });
});

describe("relatedVersions", () => {
  it("shows only the entity itself at zero hops", () => {
    expect(lanes("connection:100", 0)).toEqual(["connection 100"]);
  });

  it("shows a connection with its parties, group, mapping and joined rows", () => {
    expect(lanes("connection:100", 1)).toEqual([
      "party 1",
      "party 2",
      "group 10",
      "connection 100",
      "group 10 · connection 100",
      "group 10 · connection 100 · party 1 · party 2",
    ]);
  });

  it("leaves out rows that step outside the neighbourhood", () => {
    expect(lanes("connection:100", 1)).not.toContain("connection 101");
  });
});

describe("entityNames", () => {
  it("lists every referenced entity", () => {
    expect(entityNames(versions)).toEqual(["connection", "group", "party"]);
  });
});

describe("entityIds", () => {
  it("lists distinct ids of one entity", () => {
    expect(entityIds(versions, "group")).toEqual(["10", "11"]);
  });
});

describe("naturalCompare", () => {
  it("orders numbers by value", () => {
    expect(["10", "9", "100"].sort(naturalCompare)).toEqual(["9", "10", "100"]);
  });
});
