import { formatInstant, type Instant, NOW } from "../core/time";
import type { AsOf } from "../core/view";
import type { Filters } from "../core/viewState";

type ToolbarProps = {
  readonly filters: Filters;
  readonly entities: readonly string[];
  readonly ids: readonly string[];
  readonly techPoints: readonly Instant[];
  readonly onChange: (filters: Filters) => void;
  readonly onResetZoom: () => void;
  readonly onResetView: () => void;
};

const HOPS = [0, 1, 2, 3];

/** Filter controls, in one row above the charts. */
export function Toolbar(props: ToolbarProps): React.JSX.Element {
  const { filters, entities, ids, techPoints, onChange, onResetZoom, onResetView } = props;
  const set = (patch: Partial<Filters>): void => onChange({ ...filters, ...patch });
  return (
    <div className="card toolbar">
      <label className="field">
        <span className="label">Focus</span>
        <select aria-label="Entity" value={filters.entity} onChange={(e) => set({ entity: e.target.value, id: "" })}>
          {entities.map((entity) => <option key={entity} value={entity}>{entity}</option>)}
        </select>
        <input type="text" aria-label="Id" placeholder="any id" list="entity-ids" value={filters.id} onChange={(e) => set({ id: e.target.value.trim() })} />
        <datalist id="entity-ids">{ids.map((id) => <option key={id} value={id} />)}</datalist>
      </label>
      <label className="field" title="How many reference steps to follow from the focused entity">
        <span className="label">Hops</span>
        <select aria-label="Hops" value={filters.hops} disabled={filters.id === ""} onChange={(e) => set({ hops: Number(e.target.value) })}>
          {HOPS.map((hops) => <option key={hops} value={hops}>{hops}</option>)}
        </select>
      </label>
      <TechControl asOf={filters.asOf} points={techPoints} onChange={(asOf) => set({ asOf })} />
      <label className="field">
        <input type="checkbox" checked={filters.showGuides} onChange={(e) => set({ showGuides: e.target.checked })} />
        <span>Change guides</span>
      </label>
      <button type="button" className="btn reset" title="Ctrl + scroll zooms, drag pans" onClick={onResetZoom}>
        Reset zoom
      </button>
      <button type="button" className="btn" title="Back to the default focus, tech time, zoom and cursor" onClick={onResetView}>
        Reset view
      </button>
    </div>
  );
}

type TechControlProps = {
  readonly asOf: AsOf;
  readonly points: readonly Instant[];
  readonly onChange: (asOf: AsOf) => void;
};

/** Pick the tech time to view: stepping through every instant the data changed, or all at once. */
function TechControl({ asOf, points, onChange }: TechControlProps): React.JSX.Element {
  const stops = [...points, NOW];
  const index = asOf === "all" ? stops.length - 1 : nearestIndex(stops, asOf);
  const step = (delta: number): void => onChange(stops[Math.min(Math.max(index + delta, 0), stops.length - 1)] ?? NOW);
  const all = asOf === "all";
  return (
    <div className="field">
      <span className="label">Tech time</span>
      <div className="segmented">
        <button type="button" aria-pressed={!all} onClick={() => onChange(stops[index] ?? NOW)}>As of</button>
        <button type="button" aria-pressed={all} onClick={() => onChange("all")}>All versions</button>
      </div>
      <div className="tech-slider">
        <button type="button" className="btn icon" aria-label="Previous change" disabled={all || index === 0} onClick={() => step(-1)}>‹</button>
        <input type="range" aria-label="Tech time" min={0} max={stops.length - 1} value={index} disabled={all} onChange={(e) => onChange(stops[Number(e.target.value)] ?? NOW)} />
        <button type="button" className="btn icon" aria-label="Next change" disabled={all || index === stops.length - 1} onClick={() => step(1)}>›</button>
        <output>{all ? "every version" : formatInstant(stops[index] ?? NOW)}</output>
      </div>
    </div>
  );
}

/** Index of the last stop at or before `value`, so a filter change keeps the view's tech time. */
export function nearestIndex(stops: readonly Instant[], value: Instant): number {
  const index = stops.findLastIndex((stop) => stop <= value);
  return Math.max(index, 0);
}
