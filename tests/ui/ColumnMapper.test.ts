import { describe, expect, it } from "vitest";

import { optionLabel, withLink } from "../../src/ui/ColumnMapper";

describe("optionLabel", () => {
  it("adds the first value", () => {
    expect(optionLabel("created", { created: "2024-01-10" })).toBe("created — 2024-01-10");
  });

  it("shows just the name for an empty value", () => {
    expect(optionLabel("deleted", { deleted: "" })).toBe("deleted");
  });

  it("shows just the name without a sample", () => {
    expect(optionLabel("deleted", undefined)).toBe("deleted");
  });

  it("shortens long values", () => {
    expect(optionLabel("note", { note: "x".repeat(40) })).toBe(`note — ${"x".repeat(23)}…`);
  });
});

describe("withLink", () => {
  const keys = { key: null, links: [{ column: "owner_id", entity: "party" }] };

  it("points a column at a table", () => {
    expect(withLink(keys, "network_id", "network").links).toContainEqual({ column: "network_id", entity: "network" });
  });

  it("replaces a column's link", () => {
    expect(withLink(keys, "owner_id", "person").links).toEqual([{ column: "owner_id", entity: "person" }]);
  });

  it("removes a column's link when set to nothing", () => {
    expect(withLink(keys, "owner_id", "").links).toEqual([]);
  });
});
