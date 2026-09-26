import type { SourceFile } from "../../src/core/dataset";
import connection from "./network/connection.csv?raw";
import joined from "./network/joined.csv?raw";
import network from "./network/network.csv?raw";
import networkConnection from "./network/network_connection.csv?raw";
import node from "./network/node.csv?raw";

/** Four linked tables and their join: richer than the app's sample, so most tests use it. */
export const NETWORK_SOURCES: readonly SourceFile[] = [
  { name: "node.csv", text: node },
  { name: "network.csv", text: network },
  { name: "connection.csv", text: connection },
  { name: "network_connection.csv", text: networkConnection },
  { name: "joined.csv", text: joined },
];
