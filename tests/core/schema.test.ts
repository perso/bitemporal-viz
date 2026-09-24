import { describe, expect, it } from "vitest";

import {
  detectTimeColumns,
  inferReferences,
  referencedEntity,
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

describe("detectTimeColumns", () => {
  it("finds the default names case-insensitively", () => {
    const header = ["id", "VALID_FROM", "valid_to", "tech_valid_from", "tech_valid_to"];
    expect(detectTimeColumns(header)).toEqual({
      validFrom: "VALID_FROM",
      validTo: "valid_to",
      techFrom: "tech_valid_from",
      techTo: "tech_valid_to",
    });
  });

  it("accepts alternative names from columns.json", () => {
    expect(detectTimeColumns(["valid_start", "valid_end", "tx_from", "tx_to"]).techFrom).toBe("tx_from");
  });

  it("names every missing column", () => {
    expect(() => detectTimeColumns(["valid_from", "valid_to"])).toThrow(
      "Missing columns: tech_valid_from, tech_valid_to",
    );
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
