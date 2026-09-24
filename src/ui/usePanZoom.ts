import { type PointerEvent, type RefObject, useEffect, useRef } from "react";

import { type Domain, panDomain, zoomDomain } from "../core/domain";
import type { Instant } from "../core/time";

export type PlotSpan = { readonly left: number; readonly right: number };

export type PanZoomHandlers = {
  readonly onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  readonly onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  readonly onPointerUp: (event: PointerEvent<SVGSVGElement>) => void;
};

type Drag = { readonly startX: number; readonly domain: Domain; moved: boolean };

const CLICK_TOLERANCE = 3;

/** Wheel-with-Ctrl zooms, horizontal scroll or drag pans, and a click reports its instant. */
export function usePanZoom(
  svgRef: RefObject<SVGSVGElement | null>,
  span: PlotSpan,
  domain: Domain,
  onDomainChange: (domain: Domain) => void,
  onClick: (instant: Instant, target: Element) => void,
): PanZoomHandlers {
  const latest = useRef({ span, domain, onDomainChange });
  const drag = useRef<Drag | null>(null);
  useEffect(() => {
    latest.current = { span, domain, onDomainChange };
  });

  const toInstant = (clientX: number, target: Element, current = latest.current): Instant => {
    const box = target.closest("svg")?.getBoundingClientRect();
    const x = clientX - (box?.left ?? 0);
    const [start, end] = current.domain;
    return start + ((x - current.span.left) / (current.span.right - current.span.left)) * (end - start);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (svg === null) return;
    const onWheel = (event: WheelEvent): void => {
      const current = latest.current;
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const anchor = toInstant(event.clientX, svg, current);
        current.onDomainChange(zoomDomain(current.domain, anchor, Math.exp(event.deltaY * 0.004)));
      } else if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        event.preventDefault();
        current.onDomainChange(panDomain(current.domain, pixelsToMillis(event.deltaX, current)));
      }
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef]);

  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      drag.current = { startX: event.clientX, domain: latest.current.domain, moved: false };
    },
    onPointerMove: (event) => {
      const active = drag.current;
      if (active === null) return;
      const dx = event.clientX - active.startX;
      if (Math.abs(dx) > CLICK_TOLERANCE) active.moved = true;
      if (active.moved) onDomainChange(panDomain(active.domain, -pixelsToMillis(dx, latest.current)));
    },
    onPointerUp: (event) => {
      const active = drag.current;
      drag.current = null;
      const target = document.elementFromPoint?.(event.clientX, event.clientY) ?? event.target;
      if (active !== null && !active.moved) onClick(toInstant(event.clientX, event.currentTarget), target as Element);
    },
  };
}

function pixelsToMillis(pixels: number, current: { span: PlotSpan; domain: Domain }): number {
  const [start, end] = current.domain;
  return (pixels / (current.span.right - current.span.left)) * (end - start);
}
