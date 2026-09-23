"use client";

import { useEffect, useRef } from "react";

/**
 * On a TV nobody can scroll, so when a list overflows its box this slowly
 * scrolls it down and back up, pausing at each end.
 */
export function AutoScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let dir = 1;
    let pauseUntil = performance.now() + 4000;
    let last = performance.now();
    let pos = el.scrollTop;
    const speed = 28; // px per second

    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 4 && now > pauseUntil) {
        pos = Math.max(0, Math.min(max, pos + dir * speed * dt));
        el.scrollTop = pos;
        if (pos >= max || pos <= 0) {
          dir = pos >= max ? -1 : 1;
          pauseUntil = now + 4000;
        }
      } else if (max <= 4) {
        pos = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div ref={ref} className={`no-scrollbar overflow-y-auto ${className ?? ""}`}>
      {children}
    </div>
  );
}
