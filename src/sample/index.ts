import type { SourceFile } from "../core/dataset";
import course from "./course.csv?raw";
import grade from "./grade.csv?raw";
import joined from "./joined.csv?raw";
import student from "./student.csv?raw";

/** Three source tables and their bitemporal join, as described in the README. */
export const SAMPLE_SOURCES: readonly SourceFile[] = [
  { name: "student.csv", text: student },
  { name: "course.csv", text: course },
  { name: "grade.csv", text: grade },
  { name: "joined.csv", text: joined },
];
