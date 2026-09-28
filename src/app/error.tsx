"use client";

import { useEffect, useState } from "react";
import { isStaleDeployError, reloadOnce } from "@/lib/reload";

const RETRY_SECONDS = 10;

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  const stale = isStaleDeployError(error);
  const [seconds, setSeconds] = useState(RETRY_SECONDS);

  // A new version was deployed: reload straight away to pick it up.
  useEffect(() => {
    if (stale) reloadOnce();
  }, [stale]);

  // Anything else: retry by itself so an unattended TV never stays stuck here.
  useEffect(() => {
    if (seconds <= 0) {
      if (!reloadOnce()) reset();
      return;
    }
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, reset]);

  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">{stale ? "Updating to the latest version…" : "Something went wrong"}</h1>
      {!stale && <p className="mt-2 text-sm text-muted">{error.message}</p>}
      <p className="mt-2 text-sm text-muted">Retrying in {Math.max(seconds, 0)}s</p>
      <button onClick={() => window.location.reload()} className="btn-primary mt-6">
        Reload now
      </button>
    </main>
  );
}
