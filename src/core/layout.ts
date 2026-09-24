import { groupBy } from "./bitemporal";
import type { Version } from "./dataset";
import { naturalCompare } from "./filter";

export type PlacedVersion = { readonly version: Version; readonly track: number };

/** One row of the timeline: all versions of one key, stacked into tracks where they overlap. */
export type Lane = {
  readonly id: string;
  readonly table: string;
  readonly key: string;
  readonly label: string;
  readonly tracks: number;
  readonly placed: readonly PlacedVersion[];
};

/**
 * Greedy interval packing on valid time: each version takes the first track that is free.
 *
 * @example assignTracks([jan–mar, feb–apr, apr–jun]) // tracks 0, 1, 0
 */
export function assignTracks(versions: readonly Version[]): PlacedVersion[] {
  const sorted = [...versions].sort(
    (a, b) => a.validFrom - b.validFrom || a.techFrom - b.techFrom,
  );
  const trackEnds: number[] = [];
  return sorted.map((version) => {
    const free = trackEnds.findIndex((end) => end <= version.validFrom);
    const track = free === -1 ? trackEnds.length : free;
    trackEnds[track] = version.validTo;
    return { version, track };
  });
}

/** Group versions into lanes, ordered by table and then naturally by key. */
export function layoutLanes(versions: readonly Version[], tableOrder: readonly string[]): Lane[] {
  const lanes = [...groupBy(versions, (v) => `${v.table}/${v.lane}`).entries()].map(
    ([id, members]): Lane => {
      const placed = assignTracks(members);
      const [first] = members as [Version];
      return {
        id,
        table: first.table,
        key: first.lane,
        label: first.laneLabel,
        tracks: Math.max(...placed.map((p) => p.track)) + 1,
        placed,
      };
    },
  );
  return lanes.sort(
    (a, b) =>
      tableOrder.indexOf(a.table) - tableOrder.indexOf(b.table) || naturalCompare(a.key, b.key),
  );
}

export const TRACK_HEIGHT = 22;
export const TRACK_GAP = 4;
export const LANE_PADDING = 7;
export const HEADER_HEIGHT = 30;

export type Row =
  | { readonly kind: "header"; readonly table: string; readonly y: number; readonly lanes: number }
  | { readonly kind: "lane"; readonly lane: Lane; readonly y: number; readonly height: number };

/** Pixel height of a lane holding `tracks` stacked bars. */
export const laneHeight = (tracks: number): number =>
  LANE_PADDING * 2 + tracks * TRACK_HEIGHT + (tracks - 1) * TRACK_GAP;

/** Stack lanes vertically, inserting a header row wherever the table changes. */
export function stackRows(lanes: readonly Lane[], top = 0): { rows: Row[]; height: number } {
  const rows: Row[] = [];
  let y = top;
  lanes.forEach((lane, i) => {
    if (lanes[i - 1]?.table !== lane.table) {
      const count = lanes.filter((l) => l.table === lane.table).length;
      rows.push({ kind: "header", table: lane.table, y, lanes: count });
      y += HEADER_HEIGHT;
    }
    const height = laneHeight(lane.tracks);
    rows.push({ kind: "lane", lane, y, height });
    y += height;
  });
  return { rows, height: y };
}
