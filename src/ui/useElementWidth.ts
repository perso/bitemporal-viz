import { type RefObject, useEffect, useState } from "react";

/** Track an element's content width; falls back to `initial` where ResizeObserver is missing. */
export function useElementWidth(ref: RefObject<HTMLElement | null>, initial = 960): number {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
