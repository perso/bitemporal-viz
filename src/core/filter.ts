import type { EntityRef, Version } from "./dataset";
import { splitRef } from "./dataset";

/**
 * Entities within `hops` steps of `seed`, stepping through any row that references both.
 *
 * @example neighbourhood(versions, "connection:100", 1) // {connection:100, party:1, party:2, network:10}
 */
export function neighbourhood(
  versions: readonly Version[],
  seed: EntityRef,
  hops: number,
): Set<EntityRef> {
  let reached = new Set([seed]);
  for (let hop = 0; hop < hops; hop++) {
    const touching = versions.filter((v) => v.refs.some((ref) => reached.has(ref)));
    reached = new Set([...reached, ...touching.flatMap((v) => v.refs)]);
  }
  return reached;
}

/**
 * Rows whose identity lies inside the neighbourhood of `seed`.
 * A connection row is identified by its connection id; a link row by all of its ids.
 */
export function relatedVersions(
  versions: readonly Version[],
  seed: EntityRef,
  hops: number,
): Version[] {
  const reached = neighbourhood(versions, seed, hops);
  return versions.filter((v) => v.keyRefs.length > 0 && v.keyRefs.every((ref) => reached.has(ref)));
}

/** Entity names that appear in any reference, sorted. */
export const entityNames = (versions: readonly Version[]): string[] =>
  [...new Set(versions.flatMap((v) => v.refs.map((ref) => splitRef(ref)[0])))].sort();

/** Ids of one entity, sorted numerically when they look numeric. */
export function entityIds(versions: readonly Version[], entity: string): string[] {
  const ids = versions.flatMap((v) =>
    v.refs.map(splitRef).filter(([name]) => name === entity).map(([, id]) => id),
  );
  return [...new Set(ids)].sort(naturalCompare);
}

/** Compare strings so that `"2" < "10"`. */
export const naturalCompare = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { numeric: true });
