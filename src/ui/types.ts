import type { Version } from "../core/dataset";

/** A hovered version and where the pointer is, for the tooltip. */
export type Hover = { readonly version: Version; readonly x: number; readonly y: number };

export type HoverHandler = (hover: Hover | null) => void;
