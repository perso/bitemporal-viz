import columnCandidates from "../config/columns.json";

export type TimeColumns = {
  readonly validFrom: string;
  readonly validTo: string;
  readonly techFrom: string;
  readonly techTo: string;
};

/** A column holding the id of an entity, e.g. `party_a_id` → `party`. */
export type Reference = { readonly column: string; readonly entity: string };

/**
 * Turn a file name into a table name, which doubles as the entity name.
 *
 * @example tableNameFromFile("Group Connection.csv") // "group_connection"
 */
export function tableNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.[^.]*$/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Find the four bitemporal columns in a header, matching names from `columns.json`. */
export function detectTimeColumns(header: readonly string[]): TimeColumns {
  const find = (role: keyof TimeColumns): string | undefined =>
    header.find((name) => columnCandidates[role].includes(name.toLowerCase()));
  const found = {
    validFrom: find("validFrom"),
    validTo: find("validTo"),
    techFrom: find("techFrom"),
    techTo: find("techTo"),
  };
  const missing = Object.entries(found)
    .filter(([, column]) => column === undefined)
    .map(([role]) => columnCandidates[role as keyof TimeColumns][0]);
  if (missing.length > 0) throw new Error(`Missing columns: ${missing.join(", ")}`);
  return found as TimeColumns;
}

/**
 * Map a `*_id` column to the longest entity name its stem equals, starts or ends with.
 *
 * @example referencedEntity("owner_party_id", ["party", "group"]) // "party"
 * @example referencedEntity("party_a_id", ["party"]) // "party"
 */
export function referencedEntity(column: string, entities: readonly string[]): string | null {
  const lower = column.toLowerCase();
  if (!lower.endsWith("_id")) return null;
  const stem = lower.slice(0, -"_id".length);
  const matches = entities.filter(
    (entity) => stem === entity || stem.startsWith(`${entity}_`) || stem.endsWith(`_${entity}`),
  );
  return matches.reduce<string | null>(
    (best, entity) => (best === null || entity.length > best.length ? entity : best),
    null,
  );
}

/** List every column in a header that references one of the known entities. */
export function inferReferences(
  header: readonly string[],
  entities: readonly string[],
): Reference[] {
  return header.flatMap((column) => {
    const entity = referencedEntity(column, entities);
    return entity === null ? [] : [{ column, entity }];
  });
}
