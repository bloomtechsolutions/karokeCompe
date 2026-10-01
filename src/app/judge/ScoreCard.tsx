"use client";

import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CRITERIA, MAX_TOTAL, fmt, toJudgePoints, type CriterionKey } from "@/lib/scoring";
import { CATEGORY_LABEL, type Contestant, type Round, type Score } from "@/lib/types";
import { saveScore, type SaveScoreState } from "./actions";

type Props = {
  contestant: Contestant;
  round: Round;
  song: string | null;
  order: number | null;
  existing: Score | null;
  onStage?: boolean;
  missed?: boolean;
  /** Judges' share of the score (70): the sheet total out of 25 converts to these points. */
  judgeWeight: number;
};

type Values = Record<CriterionKey, number>;

// Unsubmitted scores are kept on the device so they survive the page
// switching to the next performer or a reload.
function readDraft(key: string): Values | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Values) : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, values: Values | null) {
  try {
    if (values) localStorage.setItem(key, JSON.stringify(values));
    else localStorage.removeItem(key);
  } catch {
    // Storage unavailable (private mode); drafts are a convenience only.
  }
}

export function ScoreCard({
  contestant,
  round,
  song,
  order,
  existing,
  onStage = false,
  missed = false,
  judgeWeight,
}: Props) {
  const [state, action] = useActionState<SaveScoreState, FormData>(saveScore, {});
  const draftKey = `score-draft:${round}:${contestant.id}`;
  const [values, setValues] = useState<Values>(() => {
    const v = {} as Values;
    for (const c of CRITERIA) v[c.key] = existing ? existing[c.key] : 0;
    return v;
  });
  const [open, setOpen] = useState(onStage);
  const [dirty, setDirty] = useState(false);

  // Restore an unsubmitted draft after mount (localStorage is client-only).
  useEffect(() => {
    if (existing) return;
    const draft = readDraft(draftKey);
    if (draft) {
      // Clamp drafts saved under an older scale.
      const v = {} as Values;
      for (const c of CRITERIA) v[c.key] = Math.max(0, Math.min(c.max, Math.round(Number(draft[c.key]) || 0)));
      setValues(v);
      setDirty(true);
    }
  }, [draftKey, existing]);

  useEffect(() => {
    if (dirty) writeDraft(draftKey, values);
  }, [dirty, draftKey, values]);

  useEffect(() => {
    if (state.ok) writeDraft(draftKey, null);
  }, [state.ok, state.savedAt, draftKey]);
  const total = CRITERIA.reduce((s, c) => s + values[c.key], 0);
  const saved = (existing != null || state.ok) && !dirty;

  return (
    <article
      className={`card ${
        onStage
          ? "pop-in border-accent-2 ring-2 ring-accent-2/60"
          : missed && !saved
            ? "border-amber-500/60"
            : saved
              ? "border-emerald-700/60"
              : ""
      }`}
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
          <div className="text-lg font-bold tabular-nums">
            {fmt(toJudgePoints(total, judgeWeight), 1)}
            <span className="text-xs font-normal text-muted">/{judgeWeight}</span>
          </div>
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
            <fieldset key={c.key}>
              <legend className="text-sm font-medium">
                {c.label} <span className="text-xs text-muted">· {c.hint}</span>
              </legend>
              <input type="hidden" name={c.key} value={values[c.key]} />
              <div className="mt-2 grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={`${c.label} score`}>
                {Array.from({ length: c.max + 1 }, (_, n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={values[c.key] === n}
                    onClick={() => {
                      setValues((v) => ({ ...v, [c.key]: n }));
                      setDirty(true);
                    }}
                    className={`h-11 rounded-lg text-lg font-bold tabular-nums transition ${
                      values[c.key] === n
                        ? "bg-accent text-white ring-2 ring-accent-2"
                        : "border border-line bg-bg/50 text-muted hover:bg-panel-2"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
          <textarea
            name="comments"
            defaultValue={existing?.comments ?? ""}
            placeholder="Private notes (optional)"
            rows={2}
            maxLength={500}
            className="field text-sm"
          />
          <div className="flex items-center justify-between rounded-xl bg-bg/50 px-4 py-2.5 text-sm">
            <span className="text-muted">
              Total <strong className="text-ink tabular-nums">{total}</strong>/{MAX_TOTAL}
            </span>
            <span className="font-semibold text-gold tabular-nums">
              = {fmt(toJudgePoints(total, judgeWeight), 1)} / {judgeWeight} points
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton className="btn-primary flex-1">
              {existing || state.ok ? "Update score" : "Submit score"} · {total}/{MAX_TOTAL}
            </SubmitButton>
          </div>
          {state.error && <p className="text-sm text-red-300">{state.error}</p>}
          {state.ok && !dirty && (
            <p className="text-sm text-emerald-300">
              Score saved ({state.total}/{MAX_TOTAL} = {fmt(toJudgePoints(state.total ?? 0, judgeWeight), 1)}/
              {judgeWeight} points).
            </p>
          )}
        </form>
      )}
    </article>
  );
}
