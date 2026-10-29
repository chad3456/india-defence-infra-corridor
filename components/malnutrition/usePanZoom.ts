"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from "react";

/**
 * Pan, wheel-zoom and pinch for an SVG map, by viewBox. A pointer that goes
 * down and up without moving is a click, reported with the element's data-id.
 */
export type VB = [number, number, number, number];

export function usePanZoom(svg: RefObject<SVGSVGElement | null>, full: VB, onClick: (id: string | null) => void) {
  const [vb, setVb] = useState<VB>(full);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; vb: VB; moved: boolean; pinch?: number } | null>(null);
  const clamp = (w: number) => Math.min(full[2] * 1.2, Math.max(full[2] / 40, w));

  const zoomAt = useCallback((f: number, cx?: number, cy?: number) => {
    setVb((cur) => {
      const r = svg.current?.getBoundingClientRect();
      const px = r && cx !== undefined ? cur[0] + ((cx - r.left) / r.width) * cur[2] : cur[0] + cur[2] / 2;
      const py = r && cy !== undefined ? cur[1] + ((cy - r.top) / r.height) * cur[3] : cur[1] + cur[3] / 2;
      const w = clamp(cur[2] * f), h = (w * cur[3]) / cur[2];
      return [px - ((px - cur[0]) * w) / cur[2], py - ((py - cur[1]) * h) / cur[3], w, h];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  useEffect(() => {
    // React's wheel handler is passive; the page must not scroll while the map zooms.
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => { e.preventDefault(); zoomAt(e.deltaY > 0 ? 1.18 : 1 / 1.18, e.clientX, e.clientY); };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [svg, zoomAt]);

  const handlers = {
    onPointerDown(e: RPointerEvent) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const ps = [...pointers.current.values()];
      drag.current = { x: e.clientX, y: e.clientY, vb, moved: false, pinch: ps.length === 2 ? Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y) : undefined };
    },
    onPointerMove(e: RPointerEvent) {
      if (!pointers.current.has(e.pointerId) || !drag.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const ps = [...pointers.current.values()];
      if (ps.length === 2 && drag.current.pinch) {
        const f = drag.current.pinch / Math.hypot(ps[0]!.x - ps[1]!.x, ps[0]!.y - ps[1]!.y), b = drag.current.vb;
        const w = clamp(b[2] * f), h = (w * b[3]) / b[2];
        setVb([b[0] + (b[2] - w) / 2, b[1] + (b[3] - h) / 2, w, h]);
        drag.current.moved = true;
        return;
      }
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.hypot(dx, dy) > 4) drag.current.moved = true;
      if (drag.current.moved && svg.current) {
        const r = svg.current.getBoundingClientRect(), b = drag.current.vb;
        setVb([b[0] - (dx * b[2]) / r.width, b[1] - (dy * b[3]) / r.height, b[2], b[3]]);
      }
    },
    onPointerUp(e: RPointerEvent) {
      const click = drag.current && !drag.current.moved && pointers.current.size === 1;
      pointers.current.delete(e.pointerId);
      if (click) onClick((e.target as Element).getAttribute?.("data-id") ?? null);
      if (pointers.current.size === 0) drag.current = null;
    },
  };

  /** Fit a set of paths, by their data-ids. */
  const fit = useCallback((ids: string[], minW = 0) => {
    const el = svg.current;
    if (!el) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const p = el.querySelector<SVGPathElement>(`path[data-id="${CSS.escape(id)}"]`);
      if (!p) continue;
      const b = p.getBBox();
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) return;
    const pad = Math.max(x1 - x0, y1 - y0) * 0.08 + 6;
    const ar = full[2] / full[3];
    const W = Math.max(x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) * ar, minW), H = W / ar;
    setVb([(x0 + x1) / 2 - W / 2, (y0 + y1) / 2 - H / 2, W, H]);
  }, [svg, full]);

  return { vb, setVb, zoomAt, handlers, fit };
}
