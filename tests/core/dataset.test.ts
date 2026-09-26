import { describe, expect, it } from "vitest";

import { allVersions, asUnmapped, buildDataset, mergeSources, splitRef } from "../../src/core/dataset";
import { OPEN } from "../../src/core/time";
import { NETWORK_SOURCES } from "../fixtures/network";

const TIMES = "valid_from,valid_to,tech_valid_from,tech_valid_to";
const node = { name: "node.csv", text: `node_id,name,${TIMES}\n1,Alice,2024-01-01,,2024-01-01,\n` };
const link = { name: "node_link.csv", text: `node_a_id,node_b_id,${TIMES}\n1,2,2024-01-01,,2024-01-01,\n` };

const TIME_SETTINGS = { validFrom: "valid_from", validTo: "valid_to", techFrom: "tech_valid_from", techTo: "tech_valid_to" };

const sample = buildDataset(NETWORK_SOURCES);
const table = (name: string) => sample.tables.find((t) => t.name === name);
const linkTable = buildDataset([node, link]).tables.find((t) => t.name === "node_link");

describe("buildDataset", () => {
  it("puts tables with an own key before the rest", () => {
    expect(buildDataset([link, node]).tables.map((t) => t.name)).toEqual(["node", "node_link"]);
  });

  it("keeps the load-order slot for colours", () => {
    expect(buildDataset([link, node]).tables.map((t) => t.slot)).toEqual([1, 0]);
  });

  it("detects the own key column", () => {
    expect(table("connection")?.keyColumn).toBe("connection_id");
  });

  it("detects the own key of a mapping table", () => {
    expect(table("network_connection")?.keyColumn).toBe("network_connection_id");
  });

  it("has no own key for a link table", () => {
    expect(linkTable?.keyColumn).toBeNull();
  });

  it("uses every reference as the lane of a link table", () => {
    expect(linkTable?.versions[0]?.lane).toBe("node 1 · node 2");
  });

  it("shortens a composite lane label to its values", () => {
    expect(table("joined")?.versions[0]?.laneLabel).toBe("1000 · 10 · 100 · 1 · 2");
  });

  it("keeps a single-key lane label readable", () => {
    expect(table("node")?.versions[0]?.laneLabel).toBe("node 1");
  });

  it("labels a row with its first two descriptive values", () => {
    expect(table("connection")?.versions[0]?.label).toBe("supplier · customer");
  });

  it("falls back to the lane label when nothing is descriptive", () => {
    expect(linkTable?.versions[0]?.label).toBe("1 · 2");
  });

  it("collects entity references", () => {
    expect(table("connection")?.versions[0]?.refs).toEqual(["connection:100", "node:1", "node:2"]);
  });

  it("identifies a link row by all of its references", () => {
    expect(linkTable?.versions[0]?.keyRefs).toEqual(["node:1", "node:2"]);
  });

  it("skips empty references", () => {
    const text = `node_id,owner_node_id,${TIMES}\n1,,2024-01-01,,2024-01-01,\n`;
    expect(buildDataset([{ name: "node.csv", text }]).tables[0]?.versions[0]?.refs).toEqual(["node:1"]);
  });

  it("reads blank ends as open", () => {
    expect(table("node")?.versions[1]?.techTo).toBe(OPEN);
  });

  it("prefixes CSV errors with the file name", () => {
    expect(() => buildDataset([{ name: "bad.csv", text: "" }])).toThrow("bad.csv: CSV is empty");
  });

  it("holds back a table without recognisable time columns", () => {
    const text = "id,created,changed\n1,2024-01-01,";
    expect(buildDataset([{ name: "odd.csv", text }]).unmapped).toEqual([
      { name: "odd", header: ["id", "created", "changed"], guess: {}, keys: { key: null, links: [] }, sample: { id: "1", created: "2024-01-01", changed: "" }, error: null },
    ]);
  });

  it("loads the other tables when one is held back", () => {
    expect(buildDataset([node, { name: "odd.csv", text: "id\n1" }]).tables.map((t) => t.name)).toEqual(["node"]);
  });

  it("uses stored time columns", () => {
    const text = "id,a,b,c,d\n1,2024-01-01,,2024-01-01,";
    const settings = { odd: { validFrom: "a", validTo: "b", techFrom: "c", techTo: "d" } };
    expect(buildDataset([{ name: "odd.csv", text }], settings).tables[0]?.versions).toHaveLength(1);
  });

  it("holds back a table whose time columns hold bad values", () => {
    const text = "id,a,b,c,d\n1,soon,,2024-01-01,";
    const settings = { odd: { validFrom: "a", validTo: "b", techFrom: "c", techTo: "d" } };
    expect(buildDataset([{ name: "odd.csv", text }], settings).unmapped[0]?.error).toBe('Unrecognised timestamp "soon"');
  });

  it("holds back a table with an empty start time", () => {
    const text = `node_id,${TIMES}\n1,,,2024-01-01,\n`;
    expect(buildDataset([{ name: "node.csv", text }]).unmapped[0]?.error).toBe("row 2: start times must not be empty");
  });

  it("uses a stored key", () => {
    const text = `id,${TIMES}\n7,2024-01-01,,2024-01-01,\n`;
    const settings = { customers: { ...TIME_SETTINGS, keys: { key: "id", links: [] } } };
    expect(buildDataset([{ name: "customers.csv", text }], settings).tables[0]?.versions[0]?.lane).toBe("customers 7");
  });

  it("uses a stored link", () => {
    const text = `node_id,supplier_id,${TIMES}\n1,2,2024-01-01,,2024-01-01,\n`;
    const keys = { key: "node_id", links: [{ column: "supplier_id", entity: "node" }] };
    const loaded = buildDataset([{ name: "node.csv", text }], { node: { ...TIME_SETTINGS, keys } });
    expect(loaded.tables[0]?.versions[0]?.refs).toEqual(["node:1", "node:2"]);
  });

  it("puts every row in one lane when the key is set to none and nothing links", () => {
    const settings = { node: { ...TIME_SETTINGS, keys: { key: null, links: [] } } };
    expect(buildDataset([node], settings).tables[0]?.versions[0]?.lane).toBe("node");
  });

  it("uses the table name as the lane when there are no ids", () => {
    const text = `note,${TIMES}\nhi,2024-01-01,,2024-01-01,\n`;
    expect(buildDataset([{ name: "notes.csv", text }]).tables[0]?.versions[0]?.lane).toBe("notes");
  });
});

describe("asUnmapped", () => {
  it("offers a loaded table's columns for editing", () => {
    const loaded = buildDataset([node]).tables[0];
    expect(loaded && asUnmapped(loaded)).toMatchObject({ name: "node", guess: loaded?.timeColumns, error: null });
  });

  it("offers a loaded table's key and links for editing", () => {
    const loaded = buildDataset([node, link]).tables[1];
    expect(loaded && asUnmapped(loaded).keys).toEqual({
      key: null,
      links: [{ column: "node_a_id", entity: "node" }, { column: "node_b_id", entity: "node" }],
    });
  });
});

describe("mergeSources", () => {
  it("replaces a source with the same table name in place", () => {
    const updated = { name: "Node.csv", text: "new" };
    expect(mergeSources([node, link], [updated])).toEqual([updated, link]);
  });

  it("appends new tables", () => {
    expect(mergeSources([node], [link])).toEqual([node, link]);
  });
});

describe("allVersions", () => {
  it("flattens every table", () => {
    expect(allVersions(sample)).toHaveLength(33);
  });
});

describe("splitRef", () => {
  it("splits on the first colon only", () => {
    expect(splitRef("node:a:b")).toEqual(["node", "a:b"]);
  });
});
