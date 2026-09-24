import { describe, expect, it } from "vitest";

import { loadSources, parseSources, saveSources, STORAGE_KEY } from "../../src/io/storage";

const party = { name: "party.csv", text: "party_id\n1" };

function refusingStorage(name: string): Storage {
  const refuse = () => {
    throw new DOMException("refused", name);
  };
  return { ...localStorage, getItem: refuse, setItem: refuse, removeItem: refuse };
}

describe("saveSources and loadSources", () => {
  it("round-trips sources", () => {
    saveSources([party], localStorage);
    expect(loadSources(localStorage)).toEqual([party]);
  });

  it("removes the entry when nothing is loaded", () => {
    saveSources([party], localStorage);
    saveSources([], localStorage);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reports a full storage", () => {
    expect(saveSources([party], refusingStorage("QuotaExceededError"))).toBe(false);
  });

  it("reports missing storage", () => {
    expect(saveSources([party], null)).toBe(false);
  });

  it("loads nothing from blocked storage", () => {
    expect(loadSources(refusingStorage("SecurityError"))).toEqual([]);
  });

  it("loads nothing from missing storage", () => {
    expect(loadSources(null)).toEqual([]);
  });

  it("loads nothing from corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadSources(localStorage)).toEqual([]);
  });

  it("uses the browser's localStorage by default", () => {
    saveSources([party]);
    expect(loadSources()).toEqual([party]);
  });
});

describe("parseSources", () => {
  it("drops malformed entries", () => {
    expect(parseSources(JSON.stringify([party, 42, { name: "x" }]))).toEqual([party]);
  });

  it("ignores a non-array", () => {
    expect(parseSources('{"name":"x"}')).toEqual([]);
  });
});
