import { describe, expect, it } from "vitest";

import { rectanglesOverlap, snapshot } from "../../src/core/bitemporal";
import { allVersions, buildDataset, type Version } from "../../src/core/dataset";
import { NOW, parseInstant } from "../../src/core/time";
import { SAMPLE_SOURCES } from "../../src/sample";

const dataset = buildDataset(SAMPLE_SOURCES);
const versions = allVersions(dataset);
const rows = (table: string) => versions.filter((v) => v.table === table);

/** Major and grade of Alex as the review board sees February 20th, asked at `techTime`. */
function february(techTime: number): string[] {
  const seen = snapshot(versions, parseInstant("2026-02-20"), techTime);
  return seen.filter((v) => v.table === "joined").map((v) => `${v.record.major} · ${v.record.grade}`);
}

type Rectangle = Pick<Version, "validFrom" | "validTo" | "techFrom" | "techTo">;

/** Major, grade and rectangle as one string, so a computed join compares equal to `joined.csv`. */
const describeRow = (major: string | undefined, grade: string | undefined, r: Rectangle) =>
  [major, grade, r.validFrom, r.validTo, r.techFrom, r.techTo].join(" ");

const intersection = (a: Rectangle, b: Rectangle): Rectangle => ({
  validFrom: Math.max(a.validFrom, b.validFrom),
  validTo: Math.min(a.validTo, b.validTo),
  techFrom: Math.max(a.techFrom, b.techFrom),
  techTo: Math.min(a.techTo, b.techTo),
});

const joinStudentAndGrade = (): string[] =>
  rows("student").flatMap((s) =>
    rows("grade")
      .filter((g) => g.record.student_id === s.record.student_id && rectanglesOverlap(s, g))
      .map((g) => describeRow(s.record.major, g.record.grade, intersection(s, g))),
  );

describe("sample", () => {
  it("recognises every table's time columns", () => {
    expect(dataset.unmapped).toEqual([]);
  });

  it("holds exactly the bitemporal join of student and grade in joined.csv", () => {
    const joined = rows("joined").map((j) => describeRow(j.record.major, j.record.grade, j));
    expect(joined.sort()).toEqual(joinStudentAndGrade().sort());
  });
});

describe("the review board's view of February", () => {
  it("saw a Biology student failing, as recorded on February 20th", () => {
    expect(february(parseInstant("2026-02-20"))).toEqual(["Biology · F"]);
  });

  it("would have seen a failing CS major, if asked in March", () => {
    expect(february(parseInstant("2026-03-15"))).toEqual(["CS · F"]);
  });

  it("sees a CS major with an A, as known today", () => {
    expect(february(NOW)).toEqual(["CS · A"]);
  });
});
