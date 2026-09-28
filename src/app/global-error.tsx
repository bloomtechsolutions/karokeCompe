"use client";

import { useEffect } from "react";
import { reloadOnce } from "@/lib/reload";

/** Last-resort boundary (errors in the root layout): reload after a short pause. */
export default function GlobalError() {
  useEffect(() => {
    const t = setTimeout(() => {
      if (!reloadOnce()) setTimeout(() => window.location.reload(), 15_000);
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <html lang="en">
      <body style={{ background: "#1a0710", color: "#fbeef4", fontFamily: "system-ui, sans-serif", textAlign: "center", paddingTop: "20vh" }}>
        <h1>Reconnecting…</h1>
        <p>The page will reload automatically.</p>
      </body>
    </html>
  );
}
