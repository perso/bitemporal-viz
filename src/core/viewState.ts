import type { Domain } from "./domain";
import { type Instant, NOW } from "./time";
import type { AsOf } from "./view";

export type Filters = {
  readonly entity: string;
  readonly id: string;
  readonly hops: number;
  readonly asOf: AsOf;
  readonly showGuides: boolean;
};

/** Everything about how the data is being looked at, remembered across reloads. */
export type ViewState = {
  readonly filters: Filters;
  readonly zoom: Domain | null;
  readonly cursor: Instant | null;
  readonly selectedLane: string | null;
};

export const DEFAULT_FILTERS: Filters = { entity: "", id: "", hops: 1, asOf: NOW, showGuides: true };

export const DEFAULT_VIEW_STATE: ViewState = {
  filters: DEFAULT_FILTERS,
  zoom: null,
  cursor: null,
  selectedLane: null,
};

type Json = Readonly<Record<string, unknown>>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const orDefault = <T>(value: unknown, valid: (v: unknown) => v is T, fallback: T): T =>
  valid(value) ? value : fallback;

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isNullableString = (value: unknown): value is string | null => value === null || isString(value);
const isNullableNumber = (value: unknown): value is number | null => value === null || isFiniteNumber(value);
const isAsOf = (value: unknown): value is AsOf => value === "all" || isFiniteNumber(value);
const isHops = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const isDomain = (value: unknown): value is Domain =>
  Array.isArray(value) &&
  value.length === 2 &&
  value.every(isFiniteNumber) &&
  (value[0] as number) < (value[1] as number);

/**
 * Read a stored view back, keeping each valid field and defaulting the rest.
 *
 * @example parseViewState({ filters: { id: "100" }, zoom: "junk" }) // id kept, zoom reset
 */
export function parseViewState(raw: unknown): ViewState {
  if (!isRecord(raw)) return DEFAULT_VIEW_STATE;
  return {
    filters: parseFilters(raw.filters),
    zoom: orDefault(raw.zoom, (v): v is Domain | null => v === null || isDomain(v), null),
    cursor: orDefault(raw.cursor, isNullableNumber, null),
    selectedLane: orDefault(raw.selectedLane, isNullableString, null),
  };
}

function parseFilters(raw: unknown): Filters {
  if (!isRecord(raw)) return DEFAULT_FILTERS;
  return {
    entity: orDefault(raw.entity, isString, DEFAULT_FILTERS.entity),
    id: orDefault(raw.id, isString, DEFAULT_FILTERS.id),
    hops: orDefault(raw.hops, isHops, DEFAULT_FILTERS.hops),
    asOf: orDefault(raw.asOf, isAsOf, DEFAULT_FILTERS.asOf),
    showGuides: orDefault(raw.showGuides, isBoolean, DEFAULT_FILTERS.showGuides),
  };
}
