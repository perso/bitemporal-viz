import { describe, expect, it } from "vitest";

import { OPEN } from "../../src/core/time";
import { OVERFLOW, timeScale } from "../../src/ui/scale";

const scale = timeScale([0, 1000], [100, 200], 5);

describe("timeScale", () => {
  it("maps linearly inside the domain", () => {
    expect(scale.position(500)).toBe(150);
  });

  it("puts open ends just past the range", () => {
    expect(scale.position(OPEN)).toBe(200 + OVERFLOW);
  });

  it("puts early instants just before the range", () => {
    expect(scale.position(-5)).toBe(100 - OVERFLOW);
  });

  it("overflows upwards on a reversed range", () => {
    expect(timeScale([0, 1000], [200, 100], 5).position(OPEN)).toBe(100 - OVERFLOW);
  });

  it("inverts pixels to instants", () => {
    expect(scale.invert(150)).toBe(500);
  });

  it("produces labelled ticks", () => {
    const days = timeScale([Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 8)], [0, 700], 7);
    expect(days.ticks.every((tick) => tick.label !== "")).toBe(true);
  });
});
