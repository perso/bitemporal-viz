import { describe, expect, it } from "vitest";

import { allVersions, buildDataset } from "../../src/core/dataset";
import { SAMPLE_SOURCES } from "../../src/sample";

const versions = allVersions(buildDataset(SAMPLE_SOURCES));
const lane = (table: string, key: string) => versions.filter((v) => v.table === table && v.lane === key);
const created = (table: string, key: string) => Math.min(...lane(table, key).map((v) => v.techFrom));
const deleted = (table: string, key: string) => Math.max(...lane(table, key).map((v) => v.techFrom));

describe("sample creation order: party, connection, group, membership", () => {
  it("creates connection 101's rows in order", () => {
    const order = [
      created("party", "party 3"),
      created("connection", "connection 101"),
      created("group", "group 11"),
      created("group_connection", "group 11 · connection 101"),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("creates connection 100 before its membership", () => {
    expect(created("connection", "connection 100")).toBeLessThan(
      created("group_connection", "group 10 · connection 100"),
    );
  });
});

describe("sample deletion order: the reverse", () => {
  it("closes the membership before the connection", () => {
    expect(deleted("group_connection", "group 10 · connection 100")).toBeLessThan(
      deleted("connection", "connection 100"),
    );
  });
});
