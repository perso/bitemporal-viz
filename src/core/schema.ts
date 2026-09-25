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

export type TimeRole = keyof TimeColumns;

export const TIME_ROLES: readonly TimeRole[] = ["validFrom", "validTo", "techFrom", "techTo"];

/** A table's own key column, and the other columns that link to a table by its key. */
export type Keys = { readonly key: string | null; readonly links: readonly Reference[] };

/** Columns chosen by hand for one table. Settings saved before keys could be chosen lack `keys`. */
export type TableColumns = TimeColumns & { readonly keys?: Keys };

/** Columns chosen by hand, per table name. */
export type ColumnSettings = Readonly<Record<string, TableColumns>>;

/**
 * Guess each time column from the names in `columns.json`; roles without a match are left out.
 *
 * @example guessTimeColumns(["id", "VALID_FROM", "tx_to"]) // { validFrom: "VALID_FROM", techTo: "tx_to" }
 */
export function guessTimeColumns(header: readonly string[]): Partial<TimeColumns> {
  const guesses = TIME_ROLES.flatMap((role) => {
    const column = header.find((name) => columnCandidates[role].includes(name.toLowerCase()));
    return column === undefined ? [] : [[role, column] as const];
  });
  return Object.fromEntries(guesses);
}

/** The stored choice when all its columns are still in the header, else a guess. */
export function resolveTimeColumns(
  header: readonly string[],
  stored: TimeColumns | undefined,
): Partial<TimeColumns> {
  const fits = stored !== undefined && TIME_ROLES.every((role) => header.includes(stored[role]));
  return fits ? stored : guessTimeColumns(header);
}

/** All four columns when every role is filled with a different column, else `null`. */
export function completeTimeColumns(partial: Partial<TimeColumns>): TimeColumns | null {
  const columns = TIME_ROLES.map((role) => partial[role]);
  if (columns.some((column) => column === undefined || column === "")) return null;
  if (new Set(columns).size !== columns.length) return null;
  return partial as TimeColumns;
}

/**
 * Keep only complete, well-formed entries from stored JSON; malformed keys are dropped on their own.
 *
 * @example parseColumnSettings({ party: { validFrom: "vf", ... }, junk: 1 }) // { party: … }
 */
export function parseColumnSettings(raw: unknown): ColumnSettings {
  if (!isRecord(raw)) return {};
  const entries = Object.entries(raw).flatMap(([table, columns]) =>
    isTimeColumns(columns) ? [[table, withValidKeys(columns)] as const] : [],
  );
  return Object.fromEntries(entries);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isTimeColumns = (value: unknown): value is TimeColumns & { readonly keys?: unknown } =>
  isRecord(value) && TIME_ROLES.every((role) => typeof value[role] === "string");

function withValidKeys({ keys, ...time }: TimeColumns & { readonly keys?: unknown }): TableColumns {
  return isKeys(keys) ? { ...time, keys } : time;
}

const isKeys = (value: unknown): value is Keys =>
  isRecord(value) &&
  (value.key === null || typeof value.key === "string") &&
  Array.isArray(value.links) &&
  value.links.every(
    (link) => isRecord(link) && typeof link.column === "string" && typeof link.entity === "string",
  );

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

/**
 * Guess the own key and the links from `*_id` column names.
 *
 * @example guessKeys("connection", ["connection_id", "party_a_id"], ["connection", "party"])
 * // { key: "connection_id", links: [{ column: "party_a_id", entity: "party" }] }
 */
export function guessKeys(
  table: string,
  header: readonly string[],
  entities: readonly string[],
): Keys {
  const references = inferReferences(header, entities);
  const key = references.find((ref) => ref.entity === table)?.column ?? null;
  return { key, links: references.filter((ref) => ref.column !== key) };
}

/**
 * The stored keys when all their columns are still in the header, else a guess.
 * Links to tables that are not loaded are left out, and come back when the table does.
 */
export function resolveKeys(
  table: string,
  header: readonly string[],
  entities: readonly string[],
  stored: Keys | undefined,
): Keys {
  const columns = [stored?.key ?? null, ...(stored?.links ?? []).map((link) => link.column)];
  const fits = columns.every((column) => column === null || header.includes(column));
  if (stored === undefined || !fits) return guessKeys(table, header, entities);
  return { key: stored.key, links: stored.links.filter((link) => entities.includes(link.entity)) };
}

/** Drop a key or link that uses a time column, and links on the key column. */
export function withoutTimeColumns(keys: Keys, time: Partial<TimeColumns>): Keys {
  const taken = new Set(Object.values(time));
  const key = keys.key !== null && taken.has(keys.key) ? null : keys.key;
  const links = keys.links.filter((link) => !taken.has(link.column) && link.column !== key);
  return { key, links };
}

/**
 * Every key and link column as a reference, in header order; the key refers to the table itself.
 *
 * @example keyReferences("party", ["owner_id", "party_id"], { key: "party_id", links: [{ column: "owner_id", entity: "party" }] })
 * // [{ column: "owner_id", entity: "party" }, { column: "party_id", entity: "party" }]
 */
export function keyReferences(table: string, header: readonly string[], keys: Keys): Reference[] {
  const own = keys.key === null ? [] : [{ column: keys.key, entity: table }];
  const position = (ref: Reference): number => header.indexOf(ref.column);
  return [...own, ...keys.links].sort((a, b) => position(a) - position(b));
}
