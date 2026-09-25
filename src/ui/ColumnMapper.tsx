import { useState } from "react";

import type { CsvRecord } from "../core/csv";
import type { UnmappedTable } from "../core/dataset";
import {
  completeTimeColumns,
  type Keys,
  type TableColumns,
  TIME_ROLES,
  type TimeColumns,
  type TimeRole,
  withoutTimeColumns,
} from "../core/schema";

const ROLE_LABELS: Readonly<Record<TimeRole, string>> = {
  validFrom: "Valid from",
  validTo: "Valid to",
  techFrom: "Tech valid from",
  techTo: "Tech valid to",
};

type ColumnMapperProps = {
  readonly table: UnmappedTable;
  /** Every loaded table, so a column can link to any of them. */
  readonly tables: readonly string[];
  readonly onApply: (columns: TableColumns) => void;
  readonly onCancel?: () => void;
};

/** Dropdowns for a table's time columns, its own key, and the tables its other columns link to. */
export function ColumnMapper({ table, tables, onApply, onCancel }: ColumnMapperProps): React.JSX.Element {
  const [time, setTime] = useState<Partial<TimeColumns>>(table.guess);
  const [keys, setKeys] = useState<Keys>(table.keys);
  const complete = completeTimeColumns(time);
  // Derived rather than stored, so a column picked as a time again gets its old link back when freed.
  const usable = withoutTimeColumns(keys, time);
  return (
    <form
      className="card mapper"
      aria-label={`Columns for ${table.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (complete !== null) onApply({ ...complete, keys: usable });
      }}
    >
      <h2>Which columns hold the times in <em>{table.name}</em>?</h2>
      <p className="meta">Each needs its own column. Blank, null or 9999-12-31 ends are read as open.</p>
      {table.error !== null && <p className="error" role="alert">{table.error}</p>}
      <TimeFields table={table} time={time} onChange={setTime} />
      <h2>Which column is its key, and which link to other tables?</h2>
      <p className="meta">Without a key, each combination of linked ids gets its own lane.</p>
      <KeyFields table={table} time={time} tables={tables} keys={usable} onChange={setKeys} />
      <div className="mapper-actions">
        <button type="submit" className="btn primary" disabled={complete === null}>Use these columns</button>
        {onCancel !== undefined && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

type TimeFieldsProps = {
  readonly table: UnmappedTable;
  readonly time: Partial<TimeColumns>;
  readonly onChange: (time: Partial<TimeColumns>) => void;
};

function TimeFields({ table, time, onChange }: TimeFieldsProps): React.JSX.Element {
  return (
    <div className="mapper-grid">
      {TIME_ROLES.map((role) => (
        <label key={role} className="field">
          <span className="label">{ROLE_LABELS[role]}</span>
          <select
            aria-label={ROLE_LABELS[role]}
            value={time[role] ?? ""}
            onChange={(e) => onChange({ ...time, [role]: e.target.value })}
          >
            <option value="">choose…</option>
            {table.header.map((column) => (
              <option key={column} value={column}>{optionLabel(column, table.sample)}</option>
            ))}
          </select>
        </label>
      ))}
    </div>
  );
}

type KeyFieldsProps = {
  readonly table: UnmappedTable;
  readonly time: Partial<TimeColumns>;
  readonly tables: readonly string[];
  readonly keys: Keys;
  readonly onChange: (keys: Keys) => void;
};

/** One dropdown for the key, then one per remaining column for the table it links to. */
function KeyFields({ table, time, tables, keys, onChange }: KeyFieldsProps): React.JSX.Element {
  const timeColumns = new Set(Object.values(time));
  const candidates = table.header.filter((column) => !timeColumns.has(column));
  const linkOf = (column: string): string => keys.links.find((link) => link.column === column)?.entity ?? "";
  return (
    <div className="mapper-grid">
      <label className="field">
        <span className="label">Key</span>
        <select aria-label="Key" value={keys.key ?? ""} onChange={(e) => onChange({ ...keys, key: e.target.value || null })}>
          <option value="">none</option>
          {candidates.map((column) => (
            <option key={column} value={column}>{optionLabel(column, table.sample)}</option>
          ))}
        </select>
      </label>
      {candidates.filter((column) => column !== keys.key).map((column) => (
        <label key={column} className="field">
          <span className="label">{column} links to</span>
          <select aria-label={`${column} links to`} value={linkOf(column)} onChange={(e) => onChange(withLink(keys, column, e.target.value))}>
            <option value="">nothing</option>
            {tables.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      ))}
    </div>
  );
}

/**
 * Point `column` at `entity`, or at nothing when `entity` is empty.
 *
 * @example withLink({ key: null, links: [] }, "owner_id", "party") // { key: null, links: [{ column: "owner_id", entity: "party" }] }
 */
export function withLink(keys: Keys, column: string, entity: string): Keys {
  const others = keys.links.filter((link) => link.column !== column);
  return { ...keys, links: entity === "" ? others : [...others, { column, entity }] };
}

/**
 * A column name with its first value, so the right column is easy to spot.
 *
 * @example optionLabel("created", { created: "2024-01-10" }) // "created — 2024-01-10"
 */
export function optionLabel(column: string, sample: CsvRecord | undefined): string {
  const value = sample?.[column] ?? "";
  return value === "" ? column : `${column} — ${value.length > 24 ? `${value.slice(0, 23)}…` : value}`;
}
