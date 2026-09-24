import type { SourceFile } from "../core/dataset";
import connection from "./connection.csv?raw";
import group from "./group.csv?raw";
import groupConnection from "./group_connection.csv?raw";
import joined from "./joined.csv?raw";
import party from "./party.csv?raw";

/** Four source tables and their bitemporal join, as described in the README. */
export const SAMPLE_SOURCES: readonly SourceFile[] = [
  { name: "party.csv", text: party },
  { name: "group.csv", text: group },
  { name: "connection.csv", text: connection },
  { name: "group_connection.csv", text: groupConnection },
  { name: "joined.csv", text: joined },
];
