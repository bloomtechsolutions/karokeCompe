"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Animates list items to their new position when the order changes (FLIP).
 * Uses offsetLeft/offsetTop so it is unaffected by the container's scroll position.
 */
export function useFlip(keys: string[]) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const pos = useRef(new Map<string, { x: number; y: number }>());
  const signature = keys.join("|");

  useLayoutEffect(() => {
    nodes.current.forEach((el, key) => {
      const next = { x: el.offsetLeft, y: el.offsetTop };
      const prev = pos.current.get(key);
      if (prev && (Math.abs(prev.x - next.x) > 1 || Math.abs(prev.y - next.y) > 1)) {
        el.animate(
          [{ transform: `translate(${prev.x - next.x}px, ${prev.y - next.y}px)` }, { transform: "translate(0, 0)" }],
          { duration: 800, easing: "cubic-bezier(.2,.8,.2,1)" },
        );
      }
      pos.current.set(key, next);
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
