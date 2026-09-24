import { isCurrent } from "../core/bitemporal";
import type { Table } from "../core/dataset";
import { formatInterval } from "../core/time";
import { seriesColor } from "./text";
import type { Hover } from "./types";

type TooltipProps = {
  readonly hover: Hover;
  readonly table: Table | undefined;
  readonly conflict: boolean;
};

const OFFSET = 14;
const WIDTH = 340;

/** Every column of the hovered version, next to the pointer. */
export function Tooltip({ hover, table, conflict }: TooltipProps): React.JSX.Element {
  const { version } = hover;
  const timeColumns = new Set(table === undefined ? [] : Object.values(table.timeColumns));
  const columns = Object.keys(version.record).filter((column) => !timeColumns.has(column));
  const flip = hover.x + OFFSET + WIDTH > window.innerWidth;
  const style = {
    left: flip ? hover.x - OFFSET - WIDTH : hover.x + OFFSET,
    top: hover.y + OFFSET,
    "--c": seriesColor(table?.slot ?? 0),
  } as React.CSSProperties;
  return (
    <div className="tooltip" role="tooltip" style={style}>
      <div className="title"><span className="swatch" />{version.table} · {version.lane}</div>
      <dl>
        <dt>valid</dt>
        <dd>{formatInterval(version.validFrom, version.validTo)}</dd>
        <dt>tech</dt>
        <dd>{formatInterval(version.techFrom, version.techTo)} {isCurrent(version) ? "" : "(superseded)"}</dd>
        {columns.map((column) => (
          <Row key={column} column={column} value={version.record[column] ?? ""} />
        ))}
      </dl>
      {conflict && <div className="badge">! overlaps another version of this key</div>}
    </div>
  );
}

const Row = ({ column, value }: { column: string; value: string }): React.JSX.Element => (
  <>
    <dt>{column}</dt>
    <dd>{value === "" ? "—" : value}</dd>
  </>
);
