import { type CsvRecord, parseCsv } from "./csv";
import { DataError } from "./errors";
import {
  completeTimeColumns,
  inferReferences,
  type Reference,
  resolveTimeColumns,
  tableNameFromFile,
  type TimeColumnSettings,
  type TimeColumns,
} from "./schema";
import { type Instant, OPEN, parseInstant } from "./time";

/** An entity identity such as `"party:1"`. */
export type EntityRef = string;

/** One bitemporal row: a rectangle in valid time × tech time. */
export type Version = {
  readonly id: string;
  readonly table: string;
  readonly lane: string;
  /** Short lane label for the gutter: just the values when the key is composite. */
  readonly laneLabel: string;
  readonly label: string;
  readonly record: CsvRecord;
  readonly refs: readonly EntityRef[];
  /** The references that identify this row's lane, e.g. `["party:1"]`. */
  readonly keyRefs: readonly EntityRef[];
  readonly validFrom: Instant;
  readonly validTo: Instant;
  readonly techFrom: Instant;
  readonly techTo: Instant;
};

export type Table = {
  readonly name: string;
  /** Position in load order; stable across reloads, so colours follow the table. */
  readonly slot: number;
  readonly header: readonly string[];
  readonly timeColumns: TimeColumns;
  readonly references: readonly Reference[];
  readonly keyColumn: string | null;
  /** Columns whose values identify a lane: the own key, else every reference. */
  readonly laneColumns: readonly Reference[];
  readonly versions: readonly Version[];
};

/** A table waiting for its time columns to be chosen, or re-chosen after an error. */
export type UnmappedTable = {
  readonly name: string;
  readonly header: readonly string[];
  readonly guess: Partial<TimeColumns>;
  /** The first row, to show example values next to each column name. */
  readonly sample: CsvRecord | undefined;
  readonly error: string | null;
};

export type Dataset = {
  readonly tables: readonly Table[];
  readonly unmapped: readonly UnmappedTable[];
};

export type SourceFile = { readonly name: string; readonly text: string };

export const entityRef = (entity: string, id: string): EntityRef => `${entity}:${id}`;

/** Split `"party:1"` into `["party", "1"]`. */
export function splitRef(ref: EntityRef): [string, string] {
  const at = ref.indexOf(":");
  return [ref.slice(0, at), ref.slice(at + 1)];
}

/**
 * Replace sources that share a table name, append new ones.
 *
 * @example mergeSources([party, joined], [joinedV2]) // [party, joinedV2]
 */
export function mergeSources(
  current: readonly SourceFile[],
  added: readonly SourceFile[],
): SourceFile[] {
  const byName = new Map(current.map((file) => [tableNameFromFile(file.name), file]));
  for (const file of added) byName.set(tableNameFromFile(file.name), file);
  return [...byName.values()];
}

/**
 * Parse every source into a table; entity tables (with an own key) come first.
 * Tables whose time columns are unknown, or hold bad timestamps, come back as `unmapped`.
 */
export function buildDataset(
  sources: readonly SourceFile[],
  settings: TimeColumnSettings = {},
): Dataset {
  const entities = sources.map((file) => tableNameFromFile(file.name));
  const built = sources.map((file, slot) => buildTable(file, slot, entities, settings));
  const tables = built.filter((table): table is Table => "versions" in table);
  const keyed = tables.filter((table) => table.keyColumn !== null);
  const unkeyed = tables.filter((table) => table.keyColumn === null);
  const unmapped = built.filter((table): table is UnmappedTable => "guess" in table);
  return { tables: [...keyed, ...unkeyed], unmapped };
}

function buildTable(
  file: SourceFile,
  slot: number,
  entities: readonly string[],
  settings: TimeColumnSettings,
): Table | UnmappedTable {
  const name = tableNameFromFile(file.name);
  const { header, records } = parseSource(file);
  const guess = resolveTimeColumns(header, settings[name]);
  const timeColumns = completeTimeColumns(guess);
  const unmapped = (error: string | null): UnmappedTable =>
    ({ name, header, guess, sample: records[0], error });
  if (timeColumns === null) return unmapped(null);
  const references = inferReferences(header, entities);
  const keyColumn = references.find((ref) => ref.entity === name)?.column ?? null;
  const laneColumns = keyColumn === null ? references : [{ column: keyColumn, entity: name }];
  const shape = { name, header, timeColumns, references, keyColumn, laneColumns };
  try {
    return { ...shape, slot, versions: records.map((record, i) => buildVersion(shape, record, i)) };
  } catch (error) {
    if (error instanceof DataError) return unmapped(error.message);
    throw error;
  }
}

function parseSource(file: SourceFile): ReturnType<typeof parseCsv> {
  try {
    return parseCsv(file.text);
  } catch (error) {
    if (error instanceof DataError) throw new DataError(`${file.name}: ${error.message}`, { cause: error });
    throw error;
  }
}

type TableShape = Omit<Table, "versions" | "slot">;

function buildVersion(table: TableShape, record: CsvRecord, index: number): Version {
  const { timeColumns: cols } = table;
  const at = (column: string): Instant => parseInstant(record[column] ?? "");
  const refsOf = (references: readonly Reference[]): EntityRef[] =>
    references
      .filter((ref) => (record[ref.column] ?? "") !== "")
      .map((ref) => entityRef(ref.entity, record[ref.column] ?? ""));
  const version = {
    id: `${table.name}#${index + 1}`,
    table: table.name,
    lane: laneKey(table, record),
    laneLabel: laneLabel(table, record),
    label: rowLabel(table, record) || laneLabel(table, record),
    record,
    refs: refsOf(table.references),
    keyRefs: refsOf(table.laneColumns),
    validFrom: at(cols.validFrom),
    validTo: at(cols.validTo),
    techFrom: at(cols.techFrom),
    techTo: at(cols.techTo),
  };
  if (version.validFrom === OPEN || version.techFrom === OPEN) {
    throw new DataError(`row ${index + 2}: start times must not be empty`);
  }
  return version;
}

/** Rows sharing a lane are versions of the same thing, e.g. `"group 10 · connection 100"`. */
function laneKey(table: TableShape, record: CsvRecord): string {
  if (table.laneColumns.length === 0) return table.name;
  return table.laneColumns.map((ref) => `${ref.entity} ${record[ref.column] ?? ""}`).join(" · ");
}

/** `"party 1"` for a single key, `"10 · 100"` for a composite one. */
function laneLabel(table: TableShape, record: CsvRecord): string {
  if (table.laneColumns.length !== 1) {
    return table.laneColumns.map((ref) => record[ref.column] ?? "").join(" · ") || table.name;
  }
  return laneKey(table, record);
}

/** The first two descriptive values, e.g. `"supplier · customer"`. */
function rowLabel(table: TableShape, record: CsvRecord): string {
  const hidden = new Set([
    ...Object.values(table.timeColumns),
    ...table.references.map((ref) => ref.column),
  ]);
  const values = table.header
    .filter((column) => !hidden.has(column))
    .map((column) => record[column] ?? "")
    .filter((value) => value !== "");
  return values.slice(0, 2).join(" · ");
}

/** A loaded table as a mapping candidate, so its time columns can be changed. */
export const asUnmapped = (table: Table): UnmappedTable => ({
  name: table.name,
  header: table.header,
  guess: table.timeColumns,
  sample: table.versions[0]?.record,
  error: null,
});

/** All versions across tables, in table order. */
export const allVersions = (dataset: Dataset): Version[] =>
  dataset.tables.flatMap((table) => table.versions);
