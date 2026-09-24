import { describe, expect, it } from "vitest";

import {
  completeTimeColumns,
  guessTimeColumns,
  inferReferences,
  parseTimeColumnSettings,
  referencedEntity,
  resolveTimeColumns,
  tableNameFromFile,
} from "../../src/core/schema";

const ENTITIES = ["party", "group", "connection", "group_connection"];

describe("tableNameFromFile", () => {
  it("strips the extension and normalises separators", () => {
    expect(tableNameFromFile("Group Connection.csv")).toBe("group_connection");
  });

  it("turns dashes into underscores", () => {
    expect(tableNameFromFile("group-connection.CSV")).toBe("group_connection");
  });
});

const COLUMNS = { validFrom: "vf", validTo: "vt", techFrom: "tf", techTo: "tt" };

describe("guessTimeColumns", () => {
  it("finds the default names case-insensitively", () => {
    const header = ["id", "VALID_FROM", "valid_to", "tech_valid_from", "tech_valid_to"];
    expect(guessTimeColumns(header)).toEqual({
      validFrom: "VALID_FROM",
      validTo: "valid_to",
      techFrom: "tech_valid_from",
      techTo: "tech_valid_to",
    });
  });

  it("accepts alternative names from columns.json", () => {
    expect(guessTimeColumns(["valid_start", "valid_end", "tx_from", "tx_to"]).techFrom).toBe("tx_from");
  });

  it("leaves out roles without a match", () => {
    expect(guessTimeColumns(["valid_from", "created_at"])).toEqual({ validFrom: "valid_from" });
  });
});

describe("resolveTimeColumns", () => {
  it("prefers a stored choice that fits the header", () => {
    expect(resolveTimeColumns(["vf", "vt", "tf", "tt"], COLUMNS)).toEqual(COLUMNS);
  });

  it("guesses when the stored columns are gone", () => {
    expect(resolveTimeColumns(["valid_from"], COLUMNS)).toEqual({ validFrom: "valid_from" });
  });

  it("guesses without a stored choice", () => {
    expect(resolveTimeColumns(["tx_to"], undefined)).toEqual({ techTo: "tx_to" });
  });
});

describe("completeTimeColumns", () => {
  it("accepts four distinct columns", () => {
    expect(completeTimeColumns(COLUMNS)).toEqual(COLUMNS);
  });

  it("rejects a missing role", () => {
    expect(completeTimeColumns({ ...COLUMNS, techTo: undefined })).toBeNull();
  });

  it("rejects an empty choice", () => {
    expect(completeTimeColumns({ ...COLUMNS, techTo: "" })).toBeNull();
  });

  it("rejects one column used twice", () => {
    expect(completeTimeColumns({ ...COLUMNS, techTo: "vf" })).toBeNull();
  });
});

describe("parseTimeColumnSettings", () => {
  it("keeps complete entries", () => {
    expect(parseTimeColumnSettings({ party: COLUMNS })).toEqual({ party: COLUMNS });
  });

  it("drops malformed entries", () => {
    expect(parseTimeColumnSettings({ party: COLUMNS, group: { validFrom: "vf" }, x: 1 })).toEqual({ party: COLUMNS });
  });

  it.each([null, [], "x"])("ignores %j", (raw) => {
    expect(parseTimeColumnSettings(raw)).toEqual({});
  });
});

describe("referencedEntity", () => {
  it.each([
    ["party_id", "party"],
    ["party_a_id", "party"],
    ["owner_party_id", "party"],
    ["group_id", "group"],
    ["group_connection_id", "group_connection"],
    ["connection_id", "connection"],
  ])("maps %s to %s", (column, entity) => {
    expect(referencedEntity(column, ENTITIES)).toBe(entity);
  });

  it("ignores columns without an _id suffix", () => {
    expect(referencedEntity("party_name", ENTITIES)).toBeNull();
  });

  it("ignores ids of unknown entities", () => {
    expect(referencedEntity("invoice_id", ENTITIES)).toBeNull();
  });
});

describe("inferReferences", () => {
  it("lists referencing columns in header order", () => {
    expect(inferReferences(["connection_id", "party_a_id", "role_a"], ENTITIES)).toEqual([
      { column: "connection_id", entity: "connection" },
      { column: "party_a_id", entity: "party" },
    ]);
  });
});
