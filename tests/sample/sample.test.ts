import { describe, expect, it } from "vitest";

import { findConflicts, rectanglesOverlap, snapshot } from "../../src/core/bitemporal";
import { allVersions, buildDataset, type Version } from "../../src/core/dataset";
import { neighbourhood } from "../../src/core/filter";
import { NOW, parseInstant } from "../../src/core/time";
import { SAMPLE_SOURCES } from "../../src/sample";

const dataset = buildDataset(SAMPLE_SOURCES);
const versions = allVersions(dataset);
const rows = (table: string) => versions.filter((v) => v.table === table);

/** Major and grade of a student as the review board sees February 20th, asked at `techTime`. */
function february(student: string, techTime: number): string[] {
  const seen = snapshot(versions, parseInstant("2026-02-20"), techTime);
  return seen
    .filter((v) => v.table === "joined" && v.record.student_id === student)
    .map((v) => `${v.record.major} · ${v.record.grade}`);
}

type Rectangle = Pick<Version, "validFrom" | "validTo" | "techFrom" | "techTo">;

/** Values and rectangle as one string, so a computed join compares equal to `joined.csv`. */
const describeRow = (values: readonly (string | undefined)[], r: Rectangle) =>
  [...values, r.validFrom, r.validTo, r.techFrom, r.techTo].join(" ");

const intersection = (a: Rectangle, b: Rectangle): Rectangle => ({
  validFrom: Math.max(a.validFrom, b.validFrom),
  validTo: Math.min(a.validTo, b.validTo),
  techFrom: Math.max(a.techFrom, b.techFrom),
  techTo: Math.min(a.techTo, b.techTo),
});

/** Every course row that coexists with a grade row, each as its joined description. */
const withCourse = (student: Version, grade: Version): string[] => {
  const both = intersection(student, grade);
  return rows("course")
    .filter((c) => c.record.course_id === grade.record.course_id && rectanglesOverlap(both, c))
    .map((c) => describeRow([student.record.major, c.record.name, grade.record.grade], intersection(both, c)));
};

const joinSample = (): string[] =>
  rows("student").flatMap((s) =>
    rows("grade")
      .filter((g) => g.record.student_id === s.record.student_id && rectanglesOverlap(s, g))
      .flatMap((g) => withCourse(s, g)),
  );

describe("sample", () => {
  it("recognises every table's time columns", () => {
    expect(dataset.unmapped).toEqual([]);
  });

  it("holds exactly the bitemporal join of student, grade and course in joined.csv", () => {
    const joined = rows("joined").map((j) =>
      describeRow([j.record.major, j.record.course_name, j.record.grade], j),
    );
    expect(joined.sort()).toEqual(joinSample().sort());
  });

  it("gives each grade its own lane per student and course", () => {
    expect(rows("grade").map((g) => g.lane)).toEqual([
      "student 101 · course CS101",
      "student 101 · course CS101",
      "student 102 · course PHYS101",
    ]);
  });

  it("reaches a course's students in one hop", () => {
    expect(neighbourhood(versions, "course:CS101", 1)).toEqual(new Set(["course:CS101", "student:101"]));
  });
});

describe("the review board's view of February", () => {
  it("saw a Biology student failing, as recorded on February 20th", () => {
    expect(february("101", parseInstant("2026-02-20"))).toEqual(["Biology · F"]);
  });

  it("would have seen a failing CS major, if asked in March", () => {
    expect(february("101", parseInstant("2026-03-15"))).toEqual(["CS · F"]);
  });

  it("sees a CS major with an A, as known today", () => {
    expect(february("101", NOW)).toEqual(["CS · A"]);
  });
});

describe("Sam's major change, recorded on time", () => {
  it("leaves no overlapping versions in the sample", () => {
    expect(findConflicts(versions)).toEqual(new Set());
  });

  it("counts Sam once, as recorded on February 20th", () => {
    expect(february("102", parseInstant("2026-02-20"))).toEqual(["Physics · B"]);
  });
});
