import { findConflicts, knownAt, techChangePoints } from "./bitemporal";
import { allVersions, type Dataset, type EntityRef, type Version } from "./dataset";
import { relatedVersions } from "./filter";
import { type Lane, layoutLanes } from "./layout";
import type { Instant } from "./time";

/** `"all"` shows every version ever recorded; an instant shows the belief at that tech time. */
export type AsOf = Instant | "all";

export type ViewOptions = {
  readonly seed: EntityRef | null;
  readonly hops: number;
  readonly asOf: AsOf;
};

export type View = {
  /** Versions matching the entity filter, across all tech time. */
  readonly related: readonly Version[];
  /** The subset drawn on the timeline. */
  readonly shown: readonly Version[];
  readonly lanes: readonly Lane[];
  readonly conflicts: ReadonlySet<string>;
  readonly techPoints: readonly Instant[];
};

/** Everything the screen needs, derived from the dataset and the filter controls. */
export function deriveView(dataset: Dataset, options: ViewOptions): View {
  const versions = allVersions(dataset);
  const related =
    options.seed === null ? versions : relatedVersions(versions, options.seed, options.hops);
  const shown = options.asOf === "all" ? related : knownAt(related, options.asOf);
  const tableOrder = dataset.tables.map((table) => table.name);
  return {
    related,
    shown,
    lanes: layoutLanes(shown, tableOrder),
    conflicts: findConflicts(related),
    techPoints: techChangePoints(related),
  };
}
