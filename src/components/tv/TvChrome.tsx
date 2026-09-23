"use client";

import { useEffect, useState } from "react";

/**
 * TV helpers: fullscreen toggle (button or "F" key), hides the cursor and
 * controls when idle, and keeps the screen awake where supported.
 */
export function TvChrome() {
  const [idle, setIdle] = useState(false);
  const [isFull, setIsFull] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 3000);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "f" && !(e.target instanceof HTMLInputElement)) toggleFullscreen();
      wake();
    };
    const onFull = () => setIsFull(Boolean(document.fullscreenElement));
    wake();
    window.addEventListener("mousemove", wake);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("mousemove", wake);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("tv-idle", idle);
  }, [idle]);

  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    const request = () => {
      if (document.visibilityState === "visible" && nav.wakeLock) {
        nav.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className={`fixed right-4 bottom-4 z-50 hidden rounded-full border border-line bg-panel/90 px-4 py-2 text-sm text-muted backdrop-blur transition-opacity duration-500 hover:text-ink lg:block ${
        idle ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      {isFull ? "Exit fullscreen" : "⛶ Fullscreen (F)"}
    </button>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => {});
}
