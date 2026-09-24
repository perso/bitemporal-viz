import { describe, expect, it } from "vitest";

import { readCsvFiles } from "../../src/io/files";

describe("readCsvFiles", () => {
  it("reads CSV files and skips others", async () => {
    const files = [new File(["a\n1"], "party.csv"), new File(["x"], "notes.txt")];
    expect(await readCsvFiles(files)).toEqual([{ name: "party.csv", text: "a\n1" }]);
  });
});
