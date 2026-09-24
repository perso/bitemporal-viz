import { seriesColor } from "./text";

type ChartDefsProps = {
  readonly id: string;
  readonly slots: readonly number[];
  readonly plot: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number };
};

/** Shared SVG definitions: a plot clip, an edge fade for bars running off-screen, per-colour hatches. */
export function ChartDefs({ id, slots, plot }: ChartDefsProps): React.JSX.Element {
  const width = plot.right - plot.left;
  return (
    <defs>
      <clipPath id={`${id}-clip`}>
        <rect x={plot.left} y={plot.top} width={width} height={plot.bottom - plot.top} />
      </clipPath>
      <linearGradient id={`${id}-fade-gradient`} gradientUnits="userSpaceOnUse" x1={plot.left} x2={plot.right}>
        <stop offset={0} stopColor="black" />
        <stop offset={Math.min(12 / width, 0.5)} stopColor="white" />
        <stop offset={Math.max(1 - 44 / width, 0.5)} stopColor="white" />
        <stop offset={1} stopColor="black" />
      </linearGradient>
      <mask id={`${id}-fade`} maskUnits="userSpaceOnUse">
        <rect x={plot.left} y={plot.top} width={width} height={plot.bottom - plot.top} fill={`url(#${id}-fade-gradient)`} />
      </mask>
      {slots.map((slot) => (
        <pattern key={slot} id={`hatch-${slot}`} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={6} stroke={seriesColor(slot)} strokeWidth={1.5} strokeOpacity={0.45} />
        </pattern>
      ))}
    </defs>
  );
}
