import { describe, expect, it } from "vitest";

import {
  assignTracks,
  HEADER_HEIGHT,
  laneHeight,
  layoutLanes,
  stackRows,
  TRACK_HEIGHT,
} from "../../src/core/layout";
import { day, version } from "../helpers";

const janMar = version({ validFrom: day("2024-01-01"), validTo: day("2024-03-01") });
const febApr = version({ validFrom: day("2024-02-01"), validTo: day("2024-04-01") });
const aprJun = version({ validFrom: day("2024-04-01"), validTo: day("2024-06-01") });

describe("assignTracks", () => {
  it("reuses a track once it is free", () => {
    expect(assignTracks([aprJun, febApr, janMar]).map((p) => [p.version.id, p.track])).toEqual([
      [janMar.id, 0],
      [febApr.id, 1],
      [aprJun.id, 0],
    ]);
  });
});

describe("layoutLanes", () => {
  const b = version({ table: "b", lane: "b 1" });
  const a10 = version({ table: "a", lane: "a 10" });
  const a9 = version({ table: "a", lane: "a 9" });

  it("orders by table, then key naturally", () => {
    expect(layoutLanes([b, a10, a9], ["a", "b"]).map((l) => l.key)).toEqual(["a 9", "a 10", "b 1"]);
  });

  it("counts the tracks a lane needs", () => {
    expect(layoutLanes([janMar, febApr, aprJun], ["t"])[0]?.tracks).toBe(2);
  });
});

describe("stackRows", () => {
  const lanes = layoutLanes(
    [version({ table: "a", lane: "a 1" }), version({ table: "a", lane: "a 2" }), version({ table: "b", lane: "b 1" })],
    ["a", "b"],
  );

  it("inserts a header whenever the table changes", () => {
    expect(stackRows(lanes).rows.map((r) => r.kind)).toEqual(["header", "lane", "lane", "header", "lane"]);
  });

  it("counts lanes in the header", () => {
    expect(stackRows(lanes).rows[0]).toMatchObject({ kind: "header", lanes: 2 });
  });

  it("adds up to the total height", () => {
    expect(stackRows(lanes, 10).height).toBe(10 + 2 * HEADER_HEIGHT + 3 * laneHeight(1));
  });
});

describe("laneHeight", () => {
  it("grows by one track height plus a gap", () => {
    expect(laneHeight(2) - laneHeight(1)).toBeGreaterThan(TRACK_HEIGHT);
  });
});
