const CHAR_WIDTH = 6.6;
const MIN_CHARS = 3;

/**
 * Shorten a label to fit `width` pixels, or `null` when not even a stub fits.
 *
 * @example fitLabel("Alice Group Oy", 60) // "Alice Gr…"
 */
export function fitLabel(label: string, width: number): string | null {
  const capacity = Math.floor(width / CHAR_WIDTH);
  if (label.length <= capacity) return label;
  if (capacity <= MIN_CHARS) return null;
  return `${label.slice(0, capacity - 1)}…`;
}

/** CSS colour for a table's load-order slot; past the eighth, tables fall back to grey. */
export const seriesColor = (slot: number): string =>
  slot < 8 ? `var(--series-${slot + 1})` : "var(--series-none)";
