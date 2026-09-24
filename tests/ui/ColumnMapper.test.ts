import { describe, expect, it } from "vitest";

import { optionLabel } from "../../src/ui/ColumnMapper";

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
