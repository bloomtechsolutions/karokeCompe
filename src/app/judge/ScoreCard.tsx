"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CRITERIA, type CriterionKey } from "@/lib/scoring";
import { CATEGORY_LABEL, type Contestant, type Score } from "@/lib/types";
import { saveScore, type SaveScoreState } from "./actions";

type Props = {
  contestant: Contestant;
  song: string | null;
  order: number | null;
  existing: Score | null;
  onStage?: boolean;
};

export function ScoreCard({ contestant, song, order, existing, onStage = false }: Props) {
  const [state, action] = useActionState<SaveScoreState, FormData>(saveScore, {});
  const [values, setValues] = useState<Record<CriterionKey, number>>(() => {
    const v = {} as Record<CriterionKey, number>;
    for (const c of CRITERIA) v[c.key] = existing ? existing[c.key] : 0;
    return v;
  });
  const [open, setOpen] = useState(!existing || onStage);
  const [dirty, setDirty] = useState(false);
  const total = CRITERIA.reduce((s, c) => s + values[c.key], 0);
  const saved = (existing != null || state.ok) && !dirty;

  return (
    <article
      className={`card ${onStage ? "border-accent-2 ring-2 ring-accent-2/60" : saved ? "border-emerald-700/60" : ""}`}
    >
      {onStage && (
        <div className="mb-3 text-xs font-bold tracking-[0.25em] text-accent-2 uppercase">🎤 On stage now</div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-2 text-sm font-bold">
          {order ?? "–"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{contestant.name}</div>
          <div className="truncate text-xs text-muted">
            {CATEGORY_LABEL[contestant.category]} · {song ?? "Song TBA"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold tabular-nums">{total}</div>
          <div className={`text-[11px] ${saved ? "text-emerald-300" : "text-muted"}`}>
            {saved ? "Saved" : dirty ? "Unsaved" : "Not scored"}
          </div>
        </div>
      </button>

      {open && (
        <form
          action={action}
          onSubmit={() => setDirty(false)}
          className="mt-4 space-y-4 border-t border-line/60 pt-4"
        >
          <input type="hidden" name="contestant_id" value={contestant.id} />
          {CRITERIA.map((c) => (
            <div key={c.key}>
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={`${contestant.id}-${c.key}`} className="text-sm font-medium">
                  {c.label} <span className="text-xs text-muted">· {c.hint}</span>
                </label>
                <span className="shrink-0 text-sm tabular-nums">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={c.max}
                    value={values[c.key]}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(c.max, Math.round(Number(e.target.value) || 0)));
                      setValues((v) => ({ ...v, [c.key]: n }));
                      setDirty(true);
                    }}
                    className="w-14 rounded-md border border-line bg-bg/60 px-1.5 py-1 text-right font-semibold"
                    aria-label={`${c.label} score`}
                  />
                  <span className="text-muted"> / {c.max}</span>
                </span>
              </div>
              <input
                id={`${contestant.id}-${c.key}`}
                name={c.key}
                type="range"
                min={0}
                max={c.max}
                step={1}
                value={values[c.key]}
                onChange={(e) => {
                  setValues((v) => ({ ...v, [c.key]: Number(e.target.value) }));
                  setDirty(true);
                }}
                className="mt-2 h-8 w-full accent-[var(--color-accent)]"
              />
            </div>
          ))}
          <textarea
            name="comments"
            defaultValue={existing?.comments ?? ""}
            placeholder="Private notes (optional)"
            rows={2}
            maxLength={500}
            className="field text-sm"
          />
          <div className="flex items-center gap-3">
            <SubmitButton className="btn-primary flex-1">
              {existing || state.ok ? "Update score" : "Submit score"} · {total}/100
            </SubmitButton>
          </div>
          {state.error && <p className="text-sm text-red-300">{state.error}</p>}
          {state.ok && !dirty && <p className="text-sm text-emerald-300">Score saved ({state.total}/100).</p>}
        </form>
      )}
    </article>
  );
}
