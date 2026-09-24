import { describe, expect, it } from "vitest";

import { DEFAULT_FILTERS, DEFAULT_VIEW_STATE, parseViewState } from "../../src/core/viewState";

const stored = {
  filters: { entity: "connection", id: "100", hops: 2, asOf: "all", showGuides: false },
  zoom: [10, 20],
  cursor: 15,
  selectedLane: "party/party 1",
};

describe("parseViewState", () => {
  it("keeps a valid stored view", () => {
    expect(parseViewState(stored)).toEqual(stored);
  });

  it("round-trips through JSON", () => {
    expect(parseViewState(JSON.parse(JSON.stringify(DEFAULT_VIEW_STATE)))).toEqual(DEFAULT_VIEW_STATE);
  });

  it.each([null, 42, "view", []])("falls back to defaults for %j", (raw) => {
    expect(parseViewState(raw)).toEqual(DEFAULT_VIEW_STATE);
  });

  it("defaults only the invalid fields", () => {
    expect(parseViewState({ ...stored, zoom: "junk" })).toEqual({ ...stored, zoom: null });
  });

  it("rejects a reversed zoom", () => {
    expect(parseViewState({ ...stored, zoom: [20, 10] }).zoom).toBeNull();
  });

  it("rejects negative hops", () => {
    expect(parseViewState({ filters: { ...stored.filters, hops: -1 } }).filters.hops).toBe(DEFAULT_FILTERS.hops);
  });

  it("accepts a numeric tech time", () => {
    expect(parseViewState({ filters: { asOf: 123 } }).filters.asOf).toBe(123);
  });

  it("rejects an unknown tech time", () => {
    expect(parseViewState({ filters: { asOf: "later" } }).filters.asOf).toBe(DEFAULT_FILTERS.asOf);
  });

  it("defaults missing filters", () => {
    expect(parseViewState({ cursor: 5 }).filters).toEqual(DEFAULT_FILTERS);
  });
});
