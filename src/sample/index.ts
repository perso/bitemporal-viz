import type { SourceFile } from "../core/dataset";
import grade from "./grade.csv?raw";
import joined from "./joined.csv?raw";
import student from "./student.csv?raw";

/** Two source tables and their bitemporal join, as described in the README. */
export const SAMPLE_SOURCES: readonly SourceFile[] = [
  { name: "student.csv", text: student },
  { name: "grade.csv", text: grade },
  { name: "joined.csv", text: joined },
];
