import { describe, expect, it } from "vitest";

import { formatInstant, formatInterval, NOW, OPEN, parseInstant } from "../../src/core/time";

describe("parseInstant", () => {
  it.each(["", "  ", "NULL", "none", "9999-12-31", "9999-12-31 23:59:59"])("reads %j as open", (raw) => {
    expect(parseInstant(raw)).toBe(OPEN);
  });

  it("reads a date as UTC midnight", () => {
    expect(parseInstant("2024-06-01")).toBe(Date.UTC(2024, 5, 1));
  });

  it("reads a space-separated datetime", () => {
    expect(parseInstant("2024-06-01 08:15:30")).toBe(Date.UTC(2024, 5, 1, 8, 15, 30));
  });

  it("keeps milliseconds from longer fractions", () => {
    expect(parseInstant("2024-06-01T08:15:30.123456")).toBe(Date.UTC(2024, 5, 1, 8, 15, 30, 123));
  });

  it("applies an offset without a colon", () => {
    expect(parseInstant("2024-06-01T10:00:00+0200")).toBe(Date.UTC(2024, 5, 1, 8));
  });

  it("applies a Z suffix", () => {
    expect(parseInstant("2024-06-01T10:00Z")).toBe(Date.UTC(2024, 5, 1, 10));
  });

  it("rejects free text", () => {
    expect(() => parseInstant("yesterday")).toThrow('Unrecognised timestamp "yesterday"');
  });

  it("rejects impossible dates", () => {
    expect(() => parseInstant("2024-13-45")).toThrow("Invalid timestamp");
  });
});

describe("formatInstant", () => {
  it("drops a midnight time", () => {
    expect(formatInstant(Date.UTC(2024, 5, 1))).toBe("2024-06-01");
  });

  it("drops zero seconds", () => {
    expect(formatInstant(Date.UTC(2024, 5, 1, 8, 15))).toBe("2024-06-01 08:15");
  });

  it("keeps non-zero seconds", () => {
    expect(formatInstant(Date.UTC(2024, 5, 1, 8, 15, 5))).toBe("2024-06-01 08:15:05");
  });

  it("shows open as infinity", () => {
    expect(formatInstant(OPEN)).toBe("∞");
  });

  it("shows NOW as now", () => {
    expect(formatInstant(NOW)).toBe("now");
  });
});

describe("formatInterval", () => {
  it("joins both ends with an arrow", () => {
    expect(formatInterval(Date.UTC(2024, 0, 1), OPEN)).toBe("2024-01-01 → ∞");
  });
});
