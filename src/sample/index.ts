import type { SourceFile } from "../core/dataset";
import connection from "./connection.csv?raw";
import network from "./network.csv?raw";
import networkConnection from "./network_connection.csv?raw";
import joined from "./joined.csv?raw";
import party from "./party.csv?raw";

/** Four source tables and their bitemporal join, as described in the README. */
export const SAMPLE_SOURCES: readonly SourceFile[] = [
  { name: "party.csv", text: party },
  { name: "network.csv", text: network },
  { name: "connection.csv", text: connection },
  { name: "network_connection.csv", text: networkConnection },
  { name: "joined.csv", text: joined },
];
