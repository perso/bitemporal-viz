import { describe, expect, it } from "vitest";

import {
  completeTimeColumns,
  guessKeys,
  guessTimeColumns,
  inferReferences,
  keyReferences,
  parseColumnSettings,
  referencedEntity,
  resolveKeys,
  resolveTimeColumns,
  tableNameFromFile,
  withoutTimeColumns,
} from "../../src/core/schema";

const ENTITIES = ["party", "network", "connection", "network_connection"];

describe("tableNameFromFile", () => {
  it("strips the extension and normalises separators", () => {
    expect(tableNameFromFile("Network Connection.csv")).toBe("network_connection");
  });

  it("turns dashes into underscores", () => {
    expect(tableNameFromFile("network-connection.CSV")).toBe("network_connection");
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

describe("parseColumnSettings", () => {
  it("keeps complete entries", () => {
    expect(parseColumnSettings({ party: COLUMNS })).toEqual({ party: COLUMNS });
  });

  it("drops malformed entries", () => {
    expect(parseColumnSettings({ party: COLUMNS, network: { validFrom: "vf" }, x: 1 })).toEqual({ party: COLUMNS });
  });

  it.each([null, [], "x"])("ignores %j", (raw) => {
    expect(parseColumnSettings(raw)).toEqual({});
  });

  it("keeps well-formed keys", () => {
    const party = { ...COLUMNS, keys: { key: "id", links: [{ column: "owner", entity: "party" }] } };
    expect(parseColumnSettings({ party })).toEqual({ party });
  });

  it("drops malformed keys but keeps the time columns", () => {
    expect(parseColumnSettings({ party: { ...COLUMNS, keys: { key: 1, links: [] } } })).toEqual({ party: COLUMNS });
  });
});

const CONNECTION = ["connection_id", "party_a_id", "note"];
const GUESSED = { key: "connection_id", links: [{ column: "party_a_id", entity: "party" }] };

describe("guessKeys", () => {
  it("takes the column named after the table as the key", () => {
    expect(guessKeys("connection", CONNECTION, ENTITIES).key).toBe("connection_id");
  });

  it("links the other id columns", () => {
    expect(guessKeys("connection", CONNECTION, ENTITIES).links).toEqual([{ column: "party_a_id", entity: "party" }]);
  });

  it("finds no key in a link table", () => {
    expect(guessKeys("network_connection", ["network_id", "connection_id"], ENTITIES).key).toBeNull();
  });
});

describe("resolveKeys", () => {
  const stored = { key: "note", links: [{ column: "party_a_id", entity: "network" }] };

  it("prefers stored keys that fit the header", () => {
    expect(resolveKeys("connection", CONNECTION, ENTITIES, stored)).toEqual(stored);
  });

  it("keeps a stored choice of no key", () => {
    expect(resolveKeys("connection", CONNECTION, ENTITIES, { key: null, links: [] })).toEqual({ key: null, links: [] });
  });

  it("guesses when a stored column is gone", () => {
    expect(resolveKeys("connection", CONNECTION, ENTITIES, { key: "id", links: [] })).toEqual(GUESSED);
  });

  it("guesses without stored keys", () => {
    expect(resolveKeys("connection", CONNECTION, ENTITIES, undefined)).toEqual(GUESSED);
  });

  it("leaves out links to tables that are not loaded", () => {
    expect(resolveKeys("connection", CONNECTION, ["connection"], stored).links).toEqual([]);
  });
});

describe("withoutTimeColumns", () => {
  const time = { validFrom: "a", validTo: "b" };

  it("drops a key that is a time column", () => {
    expect(withoutTimeColumns({ key: "a", links: [] }, time).key).toBeNull();
  });

  it("drops a link on a time column", () => {
    expect(withoutTimeColumns({ key: null, links: [{ column: "b", entity: "party" }] }, time).links).toEqual([]);
  });

  it("drops a link on the key column", () => {
    expect(withoutTimeColumns({ key: "id", links: [{ column: "id", entity: "party" }] }, time).links).toEqual([]);
  });
});

describe("keyReferences", () => {
  it("lists the key as a reference to the table itself, in header order", () => {
    const keys = { key: "id", links: [{ column: "owner", entity: "person" }] };
    expect(keyReferences("party", ["owner", "name", "id"], keys)).toEqual([
      { column: "owner", entity: "person" },
      { column: "id", entity: "party" },
    ]);
  });
});

describe("referencedEntity", () => {
  it.each([
    ["party_id", "party"],
    ["party_a_id", "party"],
    ["owner_party_id", "party"],
    ["network_id", "network"],
    ["network_connection_id", "network_connection"],
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
