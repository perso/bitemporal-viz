import { describe, expect, it } from "vitest";

import { loadItem, parseSources, saveItem } from "../../src/io/storage";

const KEY = "test-key";
const party = { name: "party.csv", text: "party_id\n1" };
const asIs = (raw: unknown) => raw;

function refusingStorage(name: string): Storage {
  const refuse = () => {
    throw new DOMException("refused", name);
  };
  return { ...localStorage, getItem: refuse, setItem: refuse, removeItem: refuse };
}

describe("saveItem and loadItem", () => {
  it("round-trips JSON", () => {
    saveItem(KEY, [party], localStorage);
    expect(loadItem(KEY, asIs, null, localStorage)).toEqual([party]);
  });

  it("runs the stored value through parse", () => {
    saveItem(KEY, [party, 42], localStorage);
    expect(loadItem(KEY, parseSources, [], localStorage)).toEqual([party]);
  });

  it("removes the entry for undefined", () => {
    saveItem(KEY, [party], localStorage);
    saveItem(KEY, undefined, localStorage);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("falls back when nothing is stored", () => {
    expect(loadItem(KEY, asIs, "fallback", localStorage)).toBe("fallback");
  });

  it("reports a full storage", () => {
    expect(saveItem(KEY, [party], refusingStorage("QuotaExceededError"))).toBe(false);
  });

  it("reports missing storage", () => {
    expect(saveItem(KEY, [party], null)).toBe(false);
  });

  it("falls back on blocked storage", () => {
    expect(loadItem(KEY, asIs, "fallback", refusingStorage("SecurityError"))).toBe("fallback");
  });

  it("falls back on missing storage", () => {
    expect(loadItem(KEY, asIs, "fallback", null)).toBe("fallback");
  });

  it("falls back on corrupt JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadItem(KEY, asIs, "fallback", localStorage)).toBe("fallback");
  });

  it("uses the browser's localStorage by default", () => {
    saveItem(KEY, [party]);
    expect(loadItem(KEY, asIs, null)).toEqual([party]);
  });
});

describe("parseSources", () => {
  it("drops malformed entries", () => {
    expect(parseSources([party, 42, { name: "x" }])).toEqual([party]);
  });

  it("ignores a non-array", () => {
    expect(parseSources({ name: "x" })).toEqual([]);
  });
});
