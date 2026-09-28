// After a new deploy, a page that was already open can fail to load code
// files that no longer exist ("Loading chunk … failed"). Reloading the page
// picks up the new version. Guarded so a real outage can't cause a reload loop.

const KEY = "karaoke-last-auto-reload";
const MIN_GAP_MS = 15_000;

export function isStaleDeployError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null | undefined;
  const text = `${e?.name ?? ""} ${e?.message ?? String(err ?? "")}`;
  return /ChunkLoadError|Loading chunk .* failed|Loading CSS chunk|Failed to fetch dynamically imported module|Failed to find Server Action/i.test(
    text,
  );
}

/** Reloads the page unless it already auto-reloaded very recently. Returns whether it reloaded. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < MIN_GAP_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage unavailable: still reload; the browser's own caching limits loops.
  }
  window.location.reload();
  return true;
}
