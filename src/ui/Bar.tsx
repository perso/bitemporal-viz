import { isCurrent } from "../core/bitemporal";
import type { Version } from "../core/dataset";
import { OPEN } from "../core/time";
import { fitLabel, seriesColor } from "./text";
import type { HoverHandler } from "./types";

type BarProps = {
  readonly version: Version;
  readonly slot: number;
  readonly x0: number;
  readonly x1: number;
  readonly y: number;
  readonly height: number;
  readonly conflict: boolean;
  readonly onHover: HoverHandler;
};

const CAP = 4;

/** One version on the timeline: a tinted bar with a solid start cap marking the change point. */
export function Bar({ version, slot, x0, x1, y, height, conflict, onHover }: BarProps): React.JSX.Element {
  const width = Math.max(x1 - x0, 2);
  const label = fitLabel(version.label, width - CAP - 12);
  const superseded = !isCurrent(version);
  const classes = ["bar", superseded && "superseded", conflict && "conflict"].filter(Boolean).join(" ");
  const radius = version.validTo === OPEN ? 0 : 4;
  return (
    <g
      className={classes}
      style={{ "--c": seriesColor(slot) } as React.CSSProperties}
      data-version={version.id}
      onPointerEnter={(e) => onHover({ version, x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => onHover({ version, x: e.clientX, y: e.clientY })}
      onPointerLeave={() => onHover(null)}
    >
      <rect className="fill" x={x0} y={y} width={width} height={height} rx={radius} />
      {superseded && <rect x={x0} y={y} width={width} height={height} rx={radius} fill={`url(#hatch-${slot})`} />}
      <rect className="cap" x={x0} y={y} width={Math.min(CAP, width)} height={height} />
      {label !== null && (
        <text x={x0 + CAP + 6} y={y + height / 2} dominantBaseline="central">
          {label}
        </text>
      )}
    </g>
  );
}
