import { STAGE_LABEL, type Stage } from "@/lib/types";

export function StageBadge({ stage }: { stage: Stage }) {
  const live = stage === "round1" || stage === "final";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-semibold tracking-wide uppercase">
      {live && <span className="h-2 w-2 animate-pulse rounded-full bg-accent-2" />}
      {STAGE_LABEL[stage]}
    </span>
  );
}
