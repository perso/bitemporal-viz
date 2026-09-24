import { describe, expect, it } from "vitest";

import { fitLabel, seriesColor } from "../../src/ui/text";

describe("fitLabel", () => {
  it("keeps a label that fits", () => {
    expect(fitLabel("Bob", 100)).toBe("Bob");
  });

  it("truncates with an ellipsis", () => {
    expect(fitLabel("Alice Group Oy", 60)).toBe("Alice Gr…");
  });

  it("gives up when not even a stub fits", () => {
    expect(fitLabel("Alice", 20)).toBeNull();
  });
});

describe("seriesColor", () => {
  it("uses the categorical slot", () => {
    expect(seriesColor(0)).toBe("var(--series-1)");
  });

  it("falls back to grey past eight tables", () => {
    expect(seriesColor(8)).toBe("var(--series-none)");
  });
});
