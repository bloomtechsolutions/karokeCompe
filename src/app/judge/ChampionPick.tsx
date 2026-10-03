"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CATEGORY_LABEL, type Category } from "@/lib/types";
import { pickChampion, type PickState } from "./actions";

export type StandingView = {
  id: string;
  name: string;
  rank: number;
  judgePoints: number | null;
  votes: number;
  audiencePoints: number | null;
  total: number | null;
};

const f1 = (n: number | null) => (n == null ? "—" : Number(n.toFixed(1)).toString());

/** One category's final standings, with the judge's champion pick. */
export function ChampionPick({
  category,
  standings,
  current,
  judgeWeight,
}: {
  category: Category;
  standings: StandingView[];
  current: string | null;
  judgeWeight: number;
}) {
  const [state, action] = useActionState<PickState, FormData>(pickChampion, {});
  const [choice, setChoice] = useState(current ?? "");
  const saved = state.ok ? choice : current;

  return (
    <form action={action} className="card space-y-3">
      <input type="hidden" name="category" value={category} />
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">{CATEGORY_LABEL[category]} champion</h3>
        <span className="text-xs text-muted">
          Judges /{judgeWeight} + Audience /{100 - judgeWeight}
        </span>
      </div>
      <ul className="space-y-2">
        {standings.map((s) => (
          <li key={s.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                choice === s.id ? "border-gold bg-gold/10" : "border-line hover:bg-panel-2"
              }`}
            >
              <input
                type="radio"
                name="contestant_id"
                value={s.id}
                checked={choice === s.id}
                onChange={() => setChoice(s.id)}
                className="h-5 w-5 accent-[var(--color-gold)]"
              />
              <span className="w-5 text-center text-sm font-bold text-muted">{s.total == null ? "–" : s.rank}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {s.name}
                  {saved === s.id && <span className="ml-2 text-xs text-gold">★ your pick</span>}
                </span>
                <span className="block text-xs text-muted tabular-nums">
                  Judges {f1(s.judgePoints)} · 🗳 {s.votes} votes = {f1(s.audiencePoints)}
                </span>
              </span>
              <span className="shrink-0 text-xl font-extrabold text-gold tabular-nums">{f1(s.total)}</span>
            </label>
          </li>
        ))}
      </ul>
      {state.error && <p className="text-sm text-red-300">{state.error}</p>}
      <SubmitButton className="btn-primary w-full" disabled={!choice || choice === saved} pendingText="Saving…">
        {saved ? "Change my pick" : `Pick ${CATEGORY_LABEL[category].toLowerCase()} champion`}
      </SubmitButton>
    </form>
  );
}
