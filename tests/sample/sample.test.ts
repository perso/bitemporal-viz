import { describe, expect, it } from "vitest";

import { allVersions, buildDataset } from "../../src/core/dataset";
import { SAMPLE_SOURCES } from "../../src/sample";

const versions = allVersions(buildDataset(SAMPLE_SOURCES));
// An empty lane would make min/max return ±Infinity and every comparison pass vacuously.
const lane = (table: string, key: string) => {
  const found = versions.filter((v) => v.table === table && v.lane === key);
  if (found.length === 0) throw new Error(`No sample rows for ${table} lane "${key}"`);
  return found;
};
const created = (table: string, key: string) => Math.min(...lane(table, key).map((v) => v.techFrom));
const deleted = (table: string, key: string) => Math.max(...lane(table, key).map((v) => v.techFrom));

describe("sample creation order: node, connection, network, membership", () => {
  it("creates connection 101's rows in order", () => {
    const order = [
      created("node", "node 3"),
      created("connection", "connection 101"),
      created("network", "network 11"),
      created("network_connection", "network_connection 1001"),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("creates connection 100 before its membership", () => {
    expect(created("connection", "connection 100")).toBeLessThan(
      created("network_connection", "network_connection 1000"),
    );
  });
});

describe("sample deletion order: the reverse", () => {
  it("closes the membership before the connection", () => {
    expect(deleted("network_connection", "network_connection 1000")).toBeLessThan(
      deleted("connection", "connection 100"),
    );
  });
});
