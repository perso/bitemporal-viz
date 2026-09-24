import { snapshot } from "../core/bitemporal";
import type { Table, Version } from "../core/dataset";
import { formatInstant, type Instant, NOW } from "../core/time";
import { seriesColor } from "./text";

type SnapshotPanelProps = {
  readonly tables: readonly Table[];
  readonly versions: readonly Version[];
  readonly validTime: Instant | null;
  readonly techTime: Instant;
};

/** The rows each table holds at one point in valid time, as known at one tech time. */
export function SnapshotPanel({ tables, versions, validTime, techTime }: SnapshotPanelProps): React.JSX.Element {
  if (validTime === null) {
    return (
      <aside className="card snapshot">
        <h2>Snapshot</h2>
        <p className="empty">Click the timeline to see which rows every table holds at that moment.</p>
      </aside>
    );
  }
  const active = snapshot(versions, validTime, techTime);
  return (
    <aside className="card snapshot" aria-label="Snapshot">
      <h2>Snapshot</h2>
      <div className="when">
        valid at {formatInstant(validTime)} · known {techTime === NOW ? "now" : `at ${formatInstant(techTime)}`}
      </div>
      {tables.map((table) => (
        <section key={table.name} style={{ "--c": seriesColor(table.slot) } as React.CSSProperties}>
          <h3><span className="swatch" />{table.name}</h3>
          <SnapshotRows table={table} rows={active.filter((v) => v.table === table.name)} />
        </section>
      ))}
    </aside>
  );
}

function SnapshotRows({ table, rows }: { table: Table; rows: readonly Version[] }): React.JSX.Element {
  if (rows.length === 0) return <div className="empty">no row</div>;
  const timeColumns = new Set(Object.values(table.timeColumns));
  const shownColumns = table.header.filter((column) => !timeColumns.has(column));
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className="row">
          <div className="lane">{row.lane}</div>
          <dl>
            {shownColumns.map((column) => (
              <Pair key={column} term={column} value={row.record[column] ?? ""} />
            ))}
          </dl>
        </div>
      ))}
    </>
  );
}

const Pair = ({ term, value }: { term: string; value: string }): React.JSX.Element => (
  <>
    <dt>{term}</dt>
    <dd>{value === "" ? "—" : value}</dd>
  </>
);
