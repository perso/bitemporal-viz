import { useRef } from "react";

import { isCurrent } from "../core/bitemporal";
import type { Version } from "../core/dataset";
import { type Domain, techDomain } from "../core/domain";
import { formatInstant, type Instant, NOW } from "../core/time";
import type { AsOf } from "../core/view";
import { ChartDefs } from "./ChartDefs";
import { fitLabel, seriesColor } from "./text";
import { type TimeScale, timeScale } from "./scale";
import { CursorLine, GUTTER, RIGHT } from "./Timeline";
import type { HoverHandler } from "./types";
import { usePanZoom } from "./usePanZoom";

const HEIGHT = 300;
const TOP = 30;
const BOTTOM = HEIGHT - 12;

type PlaneProps = {
  readonly width: number;
  readonly versions: readonly Version[];
  readonly slot: number;
  readonly domain: Domain;
  readonly asOf: AsOf;
  readonly cursor: Instant | null;
  readonly conflicts: ReadonlySet<string>;
  readonly onDomainChange: (domain: Domain) => void;
  readonly onPick: (instant: Instant) => void;
  readonly onHover: HoverHandler;
};

/** Every version of one key as a rectangle: valid time across, tech time upwards. */
export function BitemporalPlane(props: PlaneProps): React.JSX.Element | null {
  const { width, versions, slot, domain, asOf, cursor } = props;
  const svgRef = useRef<SVGSVGElement>(null);
  const plot = { left: GUTTER, right: width - RIGHT };
  const handlers = usePanZoom(svgRef, plot, domain, props.onDomainChange, (instant) => props.onPick(instant));
  const yDomain = techDomain(versions);
  if (yDomain === null) return null;
  const x = timeScale(domain, [plot.left, plot.right], Math.max(2, Math.floor((plot.right - plot.left) / 120)));
  const y = timeScale(yDomain, [BOTTOM, TOP], 6);
  return (
    <svg ref={svgRef} className="pannable" width={width} height={HEIGHT} role="img" aria-label="Bitemporal plane" {...handlers}>
      <ChartDefs id="plane" slots={[slot]} plot={{ ...plot, top: TOP, bottom: BOTTOM }} />
      <Grid x={x} y={y} />
      <g clipPath="url(#plane-clip)">
        {versions.map((version) => (
          <Rectangle key={version.id} version={version} x={x} y={y} slot={slot} conflict={props.conflicts.has(version.id)} onHover={props.onHover} />
        ))}
        {asOf !== "all" && asOf !== NOW && <AsOfLine y={y.position(asOf)} label={`as of ${formatInstant(asOf)}`} />}
      </g>
      {cursor !== null && <CursorLine x={x.position(cursor)} label={formatInstant(cursor)} top={4} bottom={BOTTOM} />}
      <text className="axis-title" x={16} y={TOP - 12}>tech time ↑</text>
    </svg>
  );
}

function Grid({ x, y }: { x: TimeScale; y: TimeScale }): React.JSX.Element {
  return (
    <g>
      {x.ticks.map((tick) => (
        <g key={`x${tick.value}`} className="tick">
          <line x1={x.position(tick.value)} x2={x.position(tick.value)} y1={TOP} y2={BOTTOM} />
        </g>
      ))}
      {y.ticks.map((tick) => (
        <g key={`y${tick.value}`} className="tick" transform={`translate(0,${y.position(tick.value)})`}>
          <line x1={GUTTER} x2="100%" />
          <text x={GUTTER - 10} textAnchor="end" dominantBaseline="central">{tick.label}</text>
        </g>
      ))}
    </g>
  );
}

type RectangleProps = {
  readonly version: Version;
  readonly x: TimeScale;
  readonly y: TimeScale;
  readonly slot: number;
  readonly conflict: boolean;
  readonly onHover: HoverHandler;
};

function Rectangle({ version, x, y, slot, conflict, onHover }: RectangleProps): React.JSX.Element {
  const left = x.position(version.validFrom);
  const right = x.position(version.validTo);
  const top = y.position(version.techTo);
  const bottom = y.position(version.techFrom);
  const label = bottom - top >= 18 ? fitLabel(version.label, right - left - 14) : null;
  const classes = ["bar", !isCurrent(version) && "superseded", conflict && "conflict"].filter(Boolean).join(" ");
  return (
    <g
      className={classes}
      mask="url(#plane-fade)"
      style={{ "--c": seriesColor(slot) } as React.CSSProperties}
      onPointerEnter={(e) => onHover({ version, x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => onHover({ version, x: e.clientX, y: e.clientY })}
      onPointerLeave={() => onHover(null)}
    >
      <rect className="fill" x={left} y={top} width={right - left} height={bottom - top} stroke="var(--surface)" strokeWidth={2} />
      {!isCurrent(version) && <rect x={left} y={top} width={right - left} height={bottom - top} fill={`url(#hatch-${slot})`} />}
      <rect className="cap" x={left} y={bottom - 3} width={right - left} height={3} />
      {label !== null && <text x={left + 8} y={bottom - 12}>{label}</text>}
    </g>
  );
}

function AsOfLine({ y, label }: { y: number; label: string }): React.JSX.Element {
  return (
    <g pointerEvents="none">
      <line className="asof-line" x1={GUTTER} x2="100%" y1={y} y2={y} />
      <text className="cursor-label" x={GUTTER + 6} y={y - 6} fill="var(--accent)">{label}</text>
    </g>
  );
}
