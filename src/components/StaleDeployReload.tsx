"use client";

import { useEffect } from "react";
import { isStaleDeployError, reloadOnce } from "@/lib/reload";

/** Reloads the page when an open tab can't load code from a replaced deployment. */
export function StaleDeployReload() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (isStaleDeployError(e.error ?? e.message)) reloadOnce();
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleDeployError(e.reason)) reloadOnce();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
