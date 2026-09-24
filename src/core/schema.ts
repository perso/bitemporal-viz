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

/** Time columns chosen by hand, per table name. */
export type TimeColumnSettings = Readonly<Record<string, TimeColumns>>;

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
 * Keep only complete, well-formed entries from stored JSON.
 *
 * @example parseTimeColumnSettings({ party: { validFrom: "vf", ... }, junk: 1 }) // { party: … }
 */
export function parseTimeColumnSettings(raw: unknown): TimeColumnSettings {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const entries = Object.entries(raw).filter(([, columns]) => isTimeColumns(columns));
  return Object.fromEntries(entries) as TimeColumnSettings;
}

const isTimeColumns = (value: unknown): value is TimeColumns =>
  typeof value === "object" &&
  value !== null &&
  TIME_ROLES.every((role) => typeof (value as Record<string, unknown>)[role] === "string");

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
