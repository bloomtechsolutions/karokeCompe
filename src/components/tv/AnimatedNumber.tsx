"use client";

import { useEffect, useRef, useState } from "react";

/** Counts smoothly from the previous value to the new one. */
export function AnimatedNumber({
  value,
  decimals = 1,
  duration = 1000,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      current.current = from + (value - from) * eased;
      setDisplay(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = display.toFixed(decimals);
  return <span className="tabular-nums">{decimals > 0 ? text.replace(/\.0+$/, "") : text}</span>;
}
