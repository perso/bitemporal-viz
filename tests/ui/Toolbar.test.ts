import { describe, expect, it } from "vitest";

import { nearestIndex } from "../../src/ui/Toolbar";

describe("nearestIndex", () => {
  it("finds an exact stop", () => {
    expect(nearestIndex([10, 20, 30], 20)).toBe(1);
  });

  it("falls back to the last stop before the value", () => {
    expect(nearestIndex([10, 20, 30], 25)).toBe(1);
  });

  it("clamps to the first stop", () => {
    expect(nearestIndex([10, 20, 30], 5)).toBe(0);
  });
});
