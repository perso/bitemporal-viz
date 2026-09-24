import { useState } from "react";

import type { CsvRecord } from "../core/csv";
import type { UnmappedTable } from "../core/dataset";
import { completeTimeColumns, TIME_ROLES, type TimeColumns, type TimeRole } from "../core/schema";

const ROLE_LABELS: Readonly<Record<TimeRole, string>> = {
  validFrom: "Valid from",
  validTo: "Valid to",
  techFrom: "Tech valid from",
  techTo: "Tech valid to",
};

type ColumnMapperProps = {
  readonly table: UnmappedTable;
  readonly onApply: (columns: TimeColumns) => void;
  readonly onCancel?: () => void;
};

/** Four dropdowns to say which columns hold a table's valid and tech times. */
export function ColumnMapper({ table, onApply, onCancel }: ColumnMapperProps): React.JSX.Element {
  const [choice, setChoice] = useState<Partial<TimeColumns>>(table.guess);
  const complete = completeTimeColumns(choice);
  return (
    <form
      className="card mapper"
      aria-label={`Time columns for ${table.name}`}
      onSubmit={(e) => {
        e.preventDefault();
        if (complete !== null) onApply(complete);
      }}
    >
      <h2>Which columns hold the times in <em>{table.name}</em>?</h2>
      <p className="meta">Each needs its own column. Blank, null or 9999-12-31 ends are read as open.</p>
      {table.error !== null && <p className="error" role="alert">{table.error}</p>}
      <div className="mapper-grid">
        {TIME_ROLES.map((role) => (
          <label key={role} className="field">
            <span className="label">{ROLE_LABELS[role]}</span>
            <select
              aria-label={ROLE_LABELS[role]}
              value={choice[role] ?? ""}
              onChange={(e) => setChoice({ ...choice, [role]: e.target.value })}
            >
              <option value="">choose…</option>
              {table.header.map((column) => (
                <option key={column} value={column}>{optionLabel(column, table.sample)}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="mapper-actions">
        <button type="submit" className="btn primary" disabled={complete === null}>Use these columns</button>
        {onCancel !== undefined && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
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
