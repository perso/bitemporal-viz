import { describe, expect, it } from "vitest";

import { allVersions, buildDataset, mergeSources, splitRef } from "../../src/core/dataset";
import { OPEN } from "../../src/core/time";
import { SAMPLE_SOURCES } from "../../src/sample";

const TIMES = "valid_from,valid_to,tech_valid_from,tech_valid_to";
const party = { name: "party.csv", text: `party_id,name,${TIMES}\n1,Alice,2024-01-01,,2024-01-01,\n` };
const link = { name: "party_link.csv", text: `party_a_id,party_b_id,${TIMES}\n1,2,2024-01-01,,2024-01-01,\n` };

const sample = buildDataset(SAMPLE_SOURCES);
const table = (name: string) => sample.tables.find((t) => t.name === name);

describe("buildDataset", () => {
  it("puts tables with an own key before the rest", () => {
    expect(buildDataset([link, party]).tables.map((t) => t.name)).toEqual(["party", "party_link"]);
  });

  it("keeps the load-order slot for colours", () => {
    expect(buildDataset([link, party]).tables.map((t) => t.slot)).toEqual([1, 0]);
  });

  it("detects the own key column", () => {
    expect(table("connection")?.keyColumn).toBe("connection_id");
  });

  it("has no own key for a link table", () => {
    expect(table("group_connection")?.keyColumn).toBeNull();
  });

  it("uses every reference as the lane of a link table", () => {
    expect(table("group_connection")?.versions[0]?.lane).toBe("group 10 · connection 100");
  });

  it("shortens a composite lane label to its values", () => {
    expect(table("joined")?.versions[0]?.laneLabel).toBe("10 · 100 · 1 · 2");
  });

  it("keeps a single-key lane label readable", () => {
    expect(table("party")?.versions[0]?.laneLabel).toBe("party 1");
  });

  it("labels a row with its first two descriptive values", () => {
    expect(table("connection")?.versions[0]?.label).toBe("supplier · customer");
  });

  it("falls back to the lane label when nothing is descriptive", () => {
    expect(table("group_connection")?.versions[0]?.label).toBe("10 · 100");
  });

  it("collects entity references", () => {
    expect(table("connection")?.versions[0]?.refs).toEqual(["connection:100", "party:1", "party:2"]);
  });

  it("identifies a link row by all of its references", () => {
    expect(table("group_connection")?.versions[0]?.keyRefs).toEqual(["group:10", "connection:100"]);
  });

  it("skips empty references", () => {
    const text = `party_id,owner_party_id,${TIMES}\n1,,2024-01-01,,2024-01-01,\n`;
    expect(buildDataset([{ name: "party.csv", text }]).tables[0]?.versions[0]?.refs).toEqual(["party:1"]);
  });

  it("reads blank ends as open", () => {
    expect(table("party")?.versions[1]?.techTo).toBe(OPEN);
  });

  it("prefixes errors with the file name", () => {
    expect(() => buildDataset([{ name: "bad.csv", text: "id\n1" }])).toThrow(/^bad\.csv: Missing columns/);
  });

  it("rejects an empty start time", () => {
    const text = `party_id,${TIMES}\n1,,,2024-01-01,\n`;
    expect(() => buildDataset([{ name: "party.csv", text }])).toThrow("row 2: start times must not be empty");
  });

  it("uses the table name as the lane when there are no ids", () => {
    const text = `note,${TIMES}\nhi,2024-01-01,,2024-01-01,\n`;
    expect(buildDataset([{ name: "notes.csv", text }]).tables[0]?.versions[0]?.lane).toBe("notes");
  });
});

describe("mergeSources", () => {
  it("replaces a source with the same table name in place", () => {
    const updated = { name: "Party.csv", text: "new" };
    expect(mergeSources([party, link], [updated])).toEqual([updated, link]);
  });

  it("appends new tables", () => {
    expect(mergeSources([party], [link])).toEqual([party, link]);
  });
});

describe("allVersions", () => {
  it("flattens every table", () => {
    expect(allVersions(sample)).toHaveLength(33);
  });
});

describe("splitRef", () => {
  it("splits on the first colon only", () => {
    expect(splitRef("party:a:b")).toEqual(["party", "a:b"]);
  });
});
