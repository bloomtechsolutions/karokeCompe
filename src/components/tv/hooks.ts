"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animates list items to their new position when the order changes (FLIP).
 * Uses offsetTop so it is unaffected by the container's scroll position.
 */
export function useFlip(keys: string[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const tops = useRef(new Map<string, number>());
  const signature = keys.join("|");

  useLayoutEffect(() => {
    nodes.current.forEach((el, key) => {
      const next = el.offsetTop;
      const prev = tops.current.get(key);
      if (prev !== undefined && Math.abs(prev - next) > 1) {
        el.animate(
          [{ transform: `translateY(${prev - next}px)` }, { transform: "translateY(0)" }],
          { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
      tops.current.set(key, next);
    });
  }, [signature]);

  return (key: string) => (el: HTMLElement | null) => {
    if (el) nodes.current.set(key, el);
    else nodes.current.delete(key);
  };
}

/** True for a moment whenever `value` changes after the first render. */
export function useFlash(value: unknown, ms = 1800) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return flash;
}
