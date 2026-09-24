import { type DragEvent, useMemo, useRef, useState } from "react";

import { validChangePoints } from "./core/bitemporal";
import { buildDataset, type Dataset, entityRef, mergeSources, type SourceFile } from "./core/dataset";
import { type Domain, tidyInstant, validDomain } from "./core/domain";
import { entityIds, entityNames } from "./core/filter";
import { type Instant, NOW } from "./core/time";
import { deriveView } from "./core/view";
import { readCsvFiles } from "./io/files";
import { SAMPLE_SOURCES } from "./sample";
import { BitemporalPlane } from "./ui/BitemporalPlane";
import { SnapshotPanel } from "./ui/SnapshotPanel";
import { seriesColor } from "./ui/text";
import { GUTTER, RIGHT, Timeline } from "./ui/Timeline";
import { type Filters, Toolbar } from "./ui/Toolbar";
import { Tooltip } from "./ui/Tooltip";
import type { Hover } from "./ui/types";
import { useElementWidth } from "./ui/useElementWidth";
import { usePersistentSources } from "./ui/usePersistentSources";

const INITIAL_FILTERS: Filters = { entity: "", id: "", hops: 1, asOf: NOW, showGuides: true };

type Loaded = { dataset: Dataset; error: null } | { dataset: null; error: string | null };

function load(sources: readonly SourceFile[]): Loaded {
  if (sources.length === 0) return { dataset: null, error: null };
  try {
    return { dataset: buildDataset(sources), error: null };
  } catch (error) {
    return { dataset: null, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Load CSVs, then explore them on a shared valid-time axis. */
export function App(): React.JSX.Element {
  const { sources, setSources, remembered } = usePersistentSources();
  const [dragging, setDragging] = useState(false);
  const loaded = useMemo(() => load(sources), [sources]);
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
      <TopBar onFiles={addFiles} onSample={() => setSources(() => SAMPLE_SOURCES)} onClear={() => setSources(() => [])} hasData={sources.length > 0} />
      {!remembered && (
        <div className="notice" role="status">
          These files are too large for this browser to remember — they will be gone after a reload.
        </div>
      )}
      {loaded.error !== null && <div className="error" role="alert">{loaded.error}</div>}
      {loaded.dataset === null ? <EmptyState onSample={() => setSources(() => SAMPLE_SOURCES)} /> : <Explorer dataset={loaded.dataset} />}
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

function EmptyState({ onSample }: { onSample: () => void }): React.JSX.Element {
  return (
    <div className="card empty-state">
      <h2>Drop CSV files here</h2>
      <p>
        One file per table, named after the entity: <code>party.csv</code>, <code>group.csv</code>…
        Each needs <code>valid_from</code>, <code>valid_to</code>, <code>tech_valid_from</code> and{" "}
        <code>tech_valid_to</code>. Columns like <code>party_a_id</code> link rows to <code>party</code>.
        Drop a file again to replace it. Files stay in this browser and are remembered across reloads.
      </p>
      <button type="button" className="btn primary" onClick={onSample}>Try the sample</button>
    </div>
  );
}

function Explorer({ dataset }: { dataset: Dataset }): React.JSX.Element {
  const [filters, setFilters] = useState<Filters>(INITIAL_FILTERS);
  const [zoom, setZoom] = useState<Domain | null>(null);
  const [cursor, setCursor] = useState<Instant | null>(null);
  const [selectedLane, setSelectedLane] = useState<string | null>(null);
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
    if (next.entity !== filters.entity || next.id !== filters.id) setZoom(null);
    setFilters({ ...next, entity: next.entity === "" ? entity : next.entity });
  };
  const pick = (instant: Instant, laneId: string | null = null): void => {
    const millisPerPixel = domain === null ? 0 : (domain[1] - domain[0]) / (width - GUTTER - RIGHT);
    setCursor(tidyInstant(instant, validChangePoints(view.related), millisPerPixel));
    if (laneId !== null) setSelectedLane(laneId);
  };

  return (
    <>
      <Toolbar filters={{ ...filters, entity }} entities={entities} ids={ids} techPoints={view.techPoints} onChange={onFilters} onResetZoom={() => setZoom(null)} />
      <Legend dataset={dataset} related={view.related} conflicts={view.conflicts} />
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
};

function Legend({ dataset, related, conflicts }: LegendProps): React.JSX.Element {
  return (
    <div className="legend">
      {dataset.tables.map((table) => (
        <span key={table.name} className="chip" style={{ "--c": seriesColor(table.slot) } as React.CSSProperties}>
          <span className="swatch" />
          {table.name}
          <span className="count">{related.filter((v) => v.table === table.name).length}</span>
        </span>
      ))}
      {conflicts.size > 0 && (
        <span className="chip warn" title="Versions of the same key whose valid × tech rectangles overlap">
          ! {conflicts.size} overlapping versions
        </span>
      )}
    </div>
  );
}
