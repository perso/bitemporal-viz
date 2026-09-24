import { useRef } from "react";

import type { Table } from "../core/dataset";
import type { Domain } from "../core/domain";
import { type Lane, type Row, stackRows, TRACK_GAP, TRACK_HEIGHT, LANE_PADDING } from "../core/layout";
import { formatInstant, type Instant } from "../core/time";
import { Bar } from "./Bar";
import { ChartDefs } from "./ChartDefs";
import { type TimeScale, timeScale } from "./scale";
import { fitLabel, seriesColor } from "./text";
import type { HoverHandler } from "./types";
import { usePanZoom } from "./usePanZoom";

export const GUTTER = 210;
export const RIGHT = 20;
const AXIS_HEIGHT = 30;

type TimelineProps = {
  readonly width: number;
  readonly lanes: readonly Lane[];
  readonly tables: ReadonlyMap<string, Table>;
  readonly domain: Domain;
  readonly cursor: Instant | null;
  readonly selectedLane: string | null;
  readonly conflicts: ReadonlySet<string>;
  readonly guides: readonly Instant[];
  readonly onDomainChange: (domain: Domain) => void;
  readonly onPick: (instant: Instant, laneId: string | null) => void;
  readonly onHover: HoverHandler;
};

/** Lanes of versions against valid time, grouped by table. */
export function Timeline(props: TimelineProps): React.JSX.Element {
  const { width, lanes, tables, domain, cursor, guides } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const plot = { left: GUTTER, right: width - RIGHT };
  const scale = timeScale(domain, [plot.left, plot.right], Math.max(2, Math.floor((plot.right - plot.left) / 120)));
  const { rows, height: rowsBottom } = stackRows(lanes, AXIS_HEIGHT);
  const height = rowsBottom + 8;
  const handlers = usePanZoom(svgRef, plot, domain, props.onDomainChange, (instant, target) =>
    props.onPick(instant, target.closest("[data-lane]")?.getAttribute("data-lane") ?? null),
  );
  const bounds = { ...plot, top: AXIS_HEIGHT, bottom: rowsBottom };
  return (
    <svg ref={svgRef} className="pannable" width={width} height={height} role="img" aria-label="Timeline of versions by valid time" {...handlers}>
      <ChartDefs id="timeline" slots={[...tables.values()].map((t) => t.slot)} plot={bounds} />
      <Axis scale={scale} top={AXIS_HEIGHT} bottom={rowsBottom} />
      {rows.map((row) => (
        <RowBackground
          key={rowKey(row)}
          row={row}
          width={width}
          table={tables.get(row.kind === "header" ? row.table : row.lane.table)}
          selectedLane={props.selectedLane}
          conflicts={props.conflicts}
        />
      ))}
      <g clipPath="url(#timeline-clip)">
        {guides.map((t) => (
          <line key={t} className="guide" x1={scale.position(t)} x2={scale.position(t)} y1={AXIS_HEIGHT} y2={rowsBottom} />
        ))}
        <g mask="url(#timeline-fade)">
          {rows.map(
            (row) =>
              row.kind === "lane" && (
                <LaneBars
                  key={row.lane.id}
                  row={row}
                  scale={scale}
                  slot={tables.get(row.lane.table)?.slot ?? 0}
                  conflicts={props.conflicts}
                  onHover={props.onHover}
                />
              ),
          )}
        </g>
      </g>
      {cursor !== null && <CursorLine x={scale.position(cursor)} label={formatInstant(cursor)} top={4} bottom={rowsBottom} />}
    </svg>
  );
}

const rowKey = (row: Row): string => (row.kind === "header" ? `header/${row.table}` : row.lane.id);

function Axis({ scale, top, bottom }: { scale: TimeScale; top: number; bottom: number }): React.JSX.Element {
  return (
    <g>
      {scale.ticks.map((tick) => (
        <g key={tick.value} className="tick" transform={`translate(${scale.position(tick.value)},0)`}>
          <line y1={top} y2={bottom} />
          <text y={top - 10} textAnchor="middle">{tick.label}</text>
        </g>
      ))}
      <line className="axis-line" x1={GUTTER} x2="100%" y1={top} y2={top} />
    </g>
  );
}

type RowBackgroundProps = Pick<TimelineProps, "selectedLane" | "conflicts"> & {
  readonly row: Row;
  readonly width: number;
  readonly table: Table | undefined;
};

function RowBackground({ row, width, table, selectedLane, conflicts }: RowBackgroundProps): React.JSX.Element {
  if (row.kind === "header") {
    const keyColumns = table?.laneColumns.map((ref) => ref.column).join(" · ") ?? "";
    return (
      <g>
        <rect x={12} y={row.y + 11} width={10} height={10} rx={3} fill={seriesColor(table?.slot ?? 0)} />
        <text className="table-header" x={30} y={row.y + 16} dominantBaseline="central">
          {row.table}
          <tspan className="table-header-count" dx={8}>
            {row.lanes} {row.lanes === 1 ? "key" : "keys"}{keyColumns === "" ? "" : ` · ${keyColumns}`}
          </tspan>
        </text>
      </g>
    );
  }
  const selected = row.lane.id === selectedLane;
  const conflicted = row.lane.placed.some((p) => conflicts.has(p.version.id));
  const label = fitLabel(row.lane.label, GUTTER - 52) ?? "";
  return (
    <g data-lane={row.lane.id}>
      <rect className={`lane-bg${selected ? " selected" : ""}`} x={0} y={row.y} width={width} height={row.height} fill="transparent">
        <title>{row.lane.key}</title>
      </rect>
      <text className={`lane-label${selected ? " selected" : ""}`} x={30} y={row.y + LANE_PADDING + TRACK_HEIGHT / 2} dominantBaseline="central">
        {label}
      </text>
      {conflicted && (
        <text className="conflict-mark" x={GUTTER - 18} y={row.y + LANE_PADDING + TRACK_HEIGHT / 2} dominantBaseline="central">
          <title>Overlapping versions: two rows claim the same valid and tech time</title>!
        </text>
      )}
    </g>
  );
}

type LaneBarsProps = Pick<TimelineProps, "conflicts" | "onHover"> & {
  readonly row: Extract<Row, { kind: "lane" }>;
  readonly scale: TimeScale;
  readonly slot: number;
};

function LaneBars({ row, scale, slot, conflicts, onHover }: LaneBarsProps): React.JSX.Element {
  return (
    <g data-lane={row.lane.id}>
      {row.lane.placed.map(({ version, track }) => (
        <Bar
          key={version.id}
          version={version}
          slot={slot}
          x0={scale.position(version.validFrom)}
          x1={scale.position(version.validTo)}
          y={row.y + LANE_PADDING + track * (TRACK_HEIGHT + TRACK_GAP)}
          height={TRACK_HEIGHT}
          conflict={conflicts.has(version.id)}
          onHover={onHover}
        />
      ))}
    </g>
  );
}

type CursorLineProps = { readonly x: number; readonly label: string; readonly top: number; readonly bottom: number };

/** A vertical marker with its instant in a pill at the top. */
export function CursorLine({ x, label, top, bottom }: CursorLineProps): React.JSX.Element {
  const pillWidth = label.length * 6.4 + 14;
  return (
    <g pointerEvents="none">
      <line className="cursor-line" x1={x} x2={x} y1={top + 18} y2={bottom} />
      <rect className="cursor-pill" x={x - pillWidth / 2} y={top} width={pillWidth} height={18} rx={9} />
      <text className="cursor-label" x={x} y={top + 9} textAnchor="middle" dominantBaseline="central">{label}</text>
    </g>
  );
}
