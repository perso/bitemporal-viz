import { type DragEvent, useMemo, useRef, useState } from "react";

import { validChangePoints } from "./core/bitemporal";
import { asUnmapped, buildDataset, type Dataset, entityRef, mergeSources, type SourceFile } from "./core/dataset";
import { tidyInstant, validDomain } from "./core/domain";
import { parseTimeColumnSettings, type TimeColumnSettings, type TimeColumns } from "./core/schema";
import { entityIds, entityNames } from "./core/filter";
import { type Instant, NOW } from "./core/time";
import { deriveView } from "./core/view";
import { DEFAULT_VIEW_STATE, type Filters, parseViewState, type ViewState } from "./core/viewState";
import { readCsvFiles } from "./io/files";
import { COLUMNS_KEY, parseSources, SOURCES_KEY, VIEW_KEY } from "./io/storage";
import { SAMPLE_SOURCES } from "./sample";
import { BitemporalPlane } from "./ui/BitemporalPlane";
import { ColumnMapper } from "./ui/ColumnMapper";
import { SnapshotPanel } from "./ui/SnapshotPanel";
import { seriesColor } from "./ui/text";
import { GUTTER, RIGHT, Timeline } from "./ui/Timeline";
import { Toolbar } from "./ui/Toolbar";
import { Tooltip } from "./ui/Tooltip";
import type { Hover } from "./ui/types";
import { useElementWidth } from "./ui/useElementWidth";
import { usePersistentState } from "./ui/usePersistentState";

const NO_SOURCES: readonly SourceFile[] = [];
const NO_SETTINGS: TimeColumnSettings = {};

type Loaded = { dataset: Dataset; error: null } | { dataset: null; error: string | null };

function load(sources: readonly SourceFile[], settings: TimeColumnSettings): Loaded {
  if (sources.length === 0) return { dataset: null, error: null };
  try {
    return { dataset: buildDataset(sources, settings), error: null };
  } catch (error) {
    return { dataset: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Load CSVs, then explore them on a shared valid-time axis. */
export function App(): React.JSX.Element {
  const files = usePersistentState(SOURCES_KEY, parseSources, NO_SOURCES);
  const view = usePersistentState(VIEW_KEY, parseViewState, DEFAULT_VIEW_STATE);
  const columns = usePersistentState(COLUMNS_KEY, parseTimeColumnSettings, NO_SETTINGS);
  const { value: sources, set: setSources } = files;
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const loaded = useMemo(() => load(sources, columns.value), [sources, columns.value]);
  const applyColumns = (table: string, chosen: TimeColumns): void => {
    columns.set((current) => ({ ...current, [table]: chosen }));
    setEditing(null);
  };
  const addFiles = async (files: Iterable<File>): Promise<void> => {
    const added = await readCsvFiles(files);
    setSources((current) => mergeSources(current, added));
  };
  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  };
  return (
    <div
      className={`app${dragging ? " dragging" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <TopBar onFiles={addFiles} onSample={() => setSources(() => SAMPLE_SOURCES)} onClear={() => { files.reset(); view.reset(); columns.reset(); }} hasData={sources.length > 0} />
      {!files.remembered && (
        <div className="notice" role="status">
          These files are too large for this browser to remember — they will be gone after a reload.
        </div>
      )}
      {loaded.error !== null && <div className="error" role="alert">{loaded.error}</div>}
      {loaded.dataset !== null && (
        <ColumnMappers dataset={loaded.dataset} editing={editing} onApply={applyColumns} onCancel={() => setEditing(null)} />
      )}
      {loaded.dataset === null ? (
        <EmptyState onSample={() => setSources(() => SAMPLE_SOURCES)} />
      ) : (
        loaded.dataset.tables.length > 0 && (
          <Explorer dataset={loaded.dataset} state={view.value} onStateChange={view.set} onReset={view.reset} onEditColumns={setEditing} />
        )
      )}
    </div>
  );
}

type TopBarProps = {
  readonly onFiles: (files: Iterable<File>) => Promise<void>;
  readonly onSample: () => void;
  readonly onClear: () => void;
  readonly hasData: boolean;
};

function TopBar({ onFiles, onSample, onClear, hasData }: TopBarProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  return (
    <header className="topbar">
      <h1>Bitemporal viewer</h1>
      <span className="subtitle">valid time × tech time, one lane per key</span>
      <div className="actions">
        <input
          ref={input}
          type="file"
          accept=".csv"
          multiple
          hidden
          aria-label="CSV files"
          onChange={(e) => { if (e.target.files) void onFiles(e.target.files); e.target.value = ""; }}
        />
        <button type="button" className="btn primary" onClick={() => input.current?.click()}>Load CSVs</button>
        <button type="button" className="btn" onClick={onSample}>Load sample</button>
        {hasData && <button type="button" className="btn" title="Forget the loaded files in this browser" onClick={onClear}>Clear</button>}
      </div>
    </header>
  );
}

type ColumnMappersProps = {
  readonly dataset: Dataset;
  readonly editing: string | null;
  readonly onApply: (table: string, columns: TimeColumns) => void;
  readonly onCancel: () => void;
};

/** A mapping card for every table that needs one, plus the table being edited, if any. */
function ColumnMappers({ dataset, editing, onApply, onCancel }: ColumnMappersProps): React.JSX.Element {
  const edited = dataset.tables.find((table) => table.name === editing);
  return (
    <>
      {dataset.unmapped.map((table) => (
        <ColumnMapper key={table.name} table={table} onApply={(chosen) => onApply(table.name, chosen)} />
      ))}
      {edited !== undefined && (
        <ColumnMapper key={edited.name} table={asUnmapped(edited)} onApply={(chosen) => onApply(edited.name, chosen)} onCancel={onCancel} />
      )}
    </>
  );
}

function EmptyState({ onSample }: { onSample: () => void }): React.JSX.Element {
  return (
    <div className="card empty-state">
      <h2>Drop CSV files here</h2>
      <p>
        One file per table, named after the entity: <code>party.csv</code>, <code>group.csv</code>…
        Each needs <code>valid_from</code>, <code>valid_to</code>, <code>tech_valid_from</code> and{" "}
        <code>tech_valid_to</code>, or you pick them from a list. Columns like <code>party_a_id</code> link rows to <code>party</code>.
        Drop a file again to replace it. Files stay in this browser and are remembered across reloads.
      </p>
      <button type="button" className="btn primary" onClick={onSample}>Try the sample</button>
    </div>
  );
}

type ExplorerProps = {
  readonly dataset: Dataset;
  readonly state: ViewState;
  readonly onStateChange: (update: (current: ViewState) => ViewState) => void;
  readonly onReset: () => void;
  readonly onEditColumns: (table: string) => void;
};

function Explorer({ dataset, state, onStateChange, onReset, onEditColumns }: ExplorerProps): React.JSX.Element {
  const { filters, zoom, cursor, selectedLane } = state;
  const patch = (change: Partial<ViewState>): void => onStateChange((current) => ({ ...current, ...change }));
  const setZoom = (next: ViewState["zoom"]): void => patch({ zoom: next });
  const [hover, setHover] = useState<Hover | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(chartRef);

  const allRefsVersions = useMemo(() => dataset.tables.flatMap((t) => t.versions), [dataset]);
  const entities = useMemo(() => entityNames(allRefsVersions), [allRefsVersions]);
  const entity = entities.includes(filters.entity) ? filters.entity : (entities[0] ?? "");
  const ids = useMemo(() => entityIds(allRefsVersions, entity), [allRefsVersions, entity]);
  const seed = filters.id === "" ? null : entityRef(entity, filters.id);
  const view = useMemo(() => deriveView(dataset, { seed, hops: filters.hops, asOf: filters.asOf }), [dataset, seed, filters.hops, filters.asOf]);

  const domain = zoom ?? validDomain(view.related);
  const tables = new Map(dataset.tables.map((t) => [t.name, t]));
  const planeLane = view.lanes.find((l) => l.id === selectedLane) ?? view.lanes.at(-1);
  const planeVersions = view.related.filter((v) => `${v.table}/${v.lane}` === planeLane?.id);
  const onFilters = (next: Filters): void => {
    const refocused = next.entity !== filters.entity || next.id !== filters.id;
    patch({ filters: { ...next, entity: next.entity === "" ? entity : next.entity }, ...(refocused && { zoom: null }) });
  };
  const pick = (instant: Instant, laneId: string | null = null): void => {
    const millisPerPixel = domain === null ? 0 : (domain[1] - domain[0]) / (width - GUTTER - RIGHT);
    patch({
      cursor: tidyInstant(instant, validChangePoints(view.related), millisPerPixel),
      ...(laneId !== null && { selectedLane: laneId }),
    });
  };

  return (
    <>
      <Toolbar filters={{ ...filters, entity }} entities={entities} ids={ids} techPoints={view.techPoints} onChange={onFilters} onResetZoom={() => setZoom(null)} onResetView={onReset} />
      <Legend dataset={dataset} related={view.related} conflicts={view.conflicts} onEditColumns={onEditColumns} />
      <div className="workspace">
        <div>
          <section className="card chart" ref={chartRef}>
            <div className="chart-title">
              <h2>Timeline</h2>
              <span className="meta">{view.shown.length} of {view.related.length} versions · bars span valid time · click to inspect a moment</span>
            </div>
            {domain === null || view.lanes.length === 0 ? (
              <p className="note">No versions match — try another id, more hops, or a later tech time.</p>
            ) : (
              <Timeline
                width={width}
                lanes={view.lanes}
                tables={tables}
                domain={domain}
                cursor={cursor}
                selectedLane={planeLane?.id ?? null}
                conflicts={view.conflicts}
                guides={filters.showGuides ? validChangePoints(view.shown) : []}
                onDomainChange={setZoom}
                onPick={pick}
                onHover={setHover}
              />
            )}
          </section>
          {planeLane !== undefined && domain !== null && (
            <section className="card chart plane">
              <div className="chart-title">
                <h2>{planeLane.key}</h2>
                <span className="meta">{planeLane.table} · every version of this key · click a lane above to switch</span>
              </div>
              <BitemporalPlane
                width={width}
                versions={planeVersions}
                slot={tables.get(planeLane.table)?.slot ?? 0}
                domain={domain}
                asOf={filters.asOf}
                cursor={cursor}
                conflicts={view.conflicts}
                onDomainChange={setZoom}
                onPick={pick}
                onHover={setHover}
              />
            </section>
          )}
        </div>
        <SnapshotPanel tables={dataset.tables} versions={view.related} validTime={cursor} techTime={filters.asOf === "all" ? NOW : filters.asOf} />
      </div>
      {hover !== null && <Tooltip hover={hover} table={tables.get(hover.version.table)} conflict={view.conflicts.has(hover.version.id)} />}
    </>
  );
}

type LegendProps = {
  readonly dataset: Dataset;
  readonly related: readonly { table: string; id: string }[];
  readonly conflicts: ReadonlySet<string>;
  readonly onEditColumns: (table: string) => void;
};

function Legend({ dataset, related, conflicts, onEditColumns }: LegendProps): React.JSX.Element {
  return (
    <div className="legend">
      {dataset.tables.map((table) => (
        <button
          key={table.name}
          type="button"
          className="chip"
          title="Change time columns"
          style={{ "--c": seriesColor(table.slot) } as React.CSSProperties}
          onClick={() => onEditColumns(table.name)}
        >
          <span className="swatch" />
          {table.name}
          <span className="count">{related.filter((v) => v.table === table.name).length}</span>
        </button>
      ))}
      {conflicts.size > 0 && (
        <span className="chip warn" title="Versions of the same key whose valid × tech rectangles overlap">
          ! {conflicts.size} overlapping versions
        </span>
      )}
    </div>
  );
}
