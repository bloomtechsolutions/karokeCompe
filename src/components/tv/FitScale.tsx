"use client";

import { useId, useLayoutEffect, useRef } from "react";

// Boards in the same group share one scale (the smallest that fits them all),
// so tiles are the same size across the Solo and Duet bands.
type Group = { fits: Map<string, number>; listeners: Set<() => void> };
const groups = new Map<string, Group>();
function groupOf(name: string): Group {
  let g = groups.get(name);
  if (!g) {
    g = { fits: new Map(), listeners: new Set() };
    groups.set(name, g);
  }
  return g;
}

/**
 * Shrinks its content (down to `min`) so it fits the height of its parent,
 * letting grids reflow into more columns as it shrinks. Must be the only
 * child of a scroll container, which takes over if even `min` doesn't fit.
 */
export function FitScale({
  children,
  min = 0.62,
  group = "tv-boards",
}: {
  children: React.ReactNode;
  min?: number;
  group?: string;
}) {
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const w = wrap.current;
    const el = inner.current;
    const box = w?.parentElement;
    if (!w || !el || !box) return;

    let frame = 0;
    const apply = (s: number) => {
      el.style.width = `${100 / s}%`;
      el.style.transform = s === 1 ? "" : `scale(${s})`;
    };
    const heightAt = (s: number) => {
      apply(s);
      return el.offsetHeight * s;
    };
    const g = groupOf(group);
    const applyShared = () => {
      const shared = Math.min(...g.fits.values());
      if (!Number.isFinite(shared)) return;
      apply(shared);
      w.style.height = `${el.offsetHeight * shared}px`;
    };
    const fit = () => {
      const available = box.clientHeight;
      if (available <= 0) return;
      let best = min;
      if (heightAt(1) <= available) {
        best = 1;
      } else {
        // Binary search the largest scale that fits.
        let lo = min;
        let hi = 1;
        for (let i = 0; i < 8; i++) {
          const mid = (lo + hi) / 2;
          if (heightAt(mid) <= available) lo = mid;
          else hi = mid;
        }
        best = lo;
      }
      const prev = g.fits.get(id);
      g.fits.set(id, best);
      applyShared();
      if (prev === undefined || Math.abs(prev - best) > 0.005) g.listeners.forEach((l) => l !== applyShared && l());
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };

    g.listeners.add(applyShared);
    fit();
    const ro = new ResizeObserver(schedule);
    ro.observe(box);
    const mo = new MutationObserver(schedule);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      g.listeners.delete(applyShared);
      g.fits.delete(id);
      g.listeners.forEach((l) => l());
    };
  }, [min, group, id]);

  return (
    <div ref={wrap} className="relative w-full overflow-hidden">
      <div ref={inner} className="origin-top-left">
        {children}
      </div>
    </div>
  );
}
