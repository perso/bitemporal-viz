import { describe, expect, it } from "vitest";

import { parseCsv, parseRows } from "../../src/core/csv";

describe("parseRows", () => {
  it("splits plain fields", () => {
    expect(parseRows("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("keeps commas and newlines inside quotes", () => {
    expect(parseRows('"x,y","line\nbreak"')).toEqual([["x,y", "line\nbreak"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseRows('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it("strips CRLF line endings", () => {
    expect(parseRows("a,b\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("drops blank lines", () => {
    expect(parseRows("a\n\n1\n")).toEqual([["a"], ["1"]]);
  });

  it("keeps empty trailing fields", () => {
    expect(parseRows("a,b,\n")).toEqual([["a", "b", ""]]);
  });
});

describe("parseCsv", () => {
  it("keys records by trimmed header", () => {
    expect(parseCsv(" id , name\n1,Alice").records).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("fills missing cells with empty strings", () => {
    expect(parseCsv("a,b\n1").records).toEqual([{ a: "1", b: "" }]);
  });

  it("ignores a byte-order mark", () => {
    expect(parseCsv("\uFEFFid\n1").header).toEqual(["id"]);
  });

  it("rejects empty input", () => {
    expect(() => parseCsv("")).toThrow("CSV is empty");
  });
});
